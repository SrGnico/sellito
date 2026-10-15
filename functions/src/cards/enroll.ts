import { randomBytes } from "node:crypto";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { enrollMissing, type BusinessDoc, type CardDoc, type Customer } from "../types";
import { StampImages } from "../images/stamps";
import { insertLoyaltyObject, saveUrl, upsertLoyaltyClass, walletKey } from "../wallet/google";
import { accessLevel } from "../payments/access";
import { cardCodeSuffix, reserveCardCode } from "./codes";
import { searchTokens } from "./search";
import { clientIp, DAY, HOUR, rateLimit } from "../security/rateLimit";

const db = () => getFirestore();

// Código de alta: va en el QR impreso (SITE_URL/c/{código}), así que es corto, fácil de tipear
// y no cambia nunca. Sin 0/o, 1/l/i para que no se confundan.
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_LENGTH = 6;

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
}

// Asigna el código de alta al negocio si todavía no tiene (lo pide el panel del dueño).
export const ensureEnrollCode = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  const businessId = req.data?.businessId;
  if (typeof businessId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(businessId)) {
    throw new HttpsError("invalid-argument", "Negocio inválido.");
  }
  const bizRef = db().doc(`businesses/${businessId}`);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const result = await db().runTransaction(async (tx) => {
      const biz = await tx.get(bizRef);
      if (!biz.exists || (biz.data() as BusinessDoc).ownerUid !== uid) {
        throw new HttpsError("permission-denied", "Este negocio no es tuyo.");
      }
      const existing = (biz.data() as BusinessDoc).enrollCode;
      if (existing) return existing;
      const codeRef = db().doc(`enrollCodes/${code}`);
      if ((await tx.get(codeRef)).exists) return null; // choque: probar otro
      tx.create(codeRef, { businessId, createdAt: FieldValue.serverTimestamp() });
      tx.update(bizRef, { enrollCode: code });
      return code;
    });
    if (result) return { code: result };
  }
  throw new HttpsError("internal", "No pudimos generar el código. Intentá de nuevo.");
});

async function loadByCode(code: unknown): Promise<{ businessId: string; b: BusinessDoc }> {
  if (typeof code !== "string" || !new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code)) {
    throw new HttpsError("not-found", "No encontramos este negocio.");
  }
  const link = await db().doc(`enrollCodes/${code}`).get();
  if (!link.exists) throw new HttpsError("not-found", "No encontramos este negocio.");
  const businessId = link.get("businessId") as string;
  const snap = await db().doc(`businesses/${businessId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "No encontramos este negocio.");
  return { businessId, b: snap.data() as BusinessDoc };
}

// Datos públicos para la página de alta (SITE_URL/c/{código}). El cliente final no lee Firestore directo.
export const getEnrollInfo = onCall(async (req) => {
  const { b } = await loadByCode(req.data?.code);
  if (isPaused(b)) return { ready: false, paused: true, name: b.name };
  const missing = enrollMissing(b);
  if (missing.length > 0) return { ready: false, name: b.name };
  return {
    ready: true,
    name: b.name,
    design: b.design ?? {},
    rule: b.rule,
    askFields: b.askFields ?? { name: true, phone: true, email: false },
  };
});

// Con la suscripción vencida el negocio no suma clientes nuevos (las tarjetas existentes siguen).
const isPaused = (b: BusinessDoc) => ["blocked", "archived"].includes(accessLevel(b.subscription));

// Versión del texto de aceptación que se mostró (web/src/content/privacy.ts).
const CONSENT_VERSION_RE = /^[a-z0-9-]{1,20}$/;

function cleanCustomer(input: unknown, ask: NonNullable<BusinessDoc["askFields"]>): Customer {
  const raw = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const customer: Customer = {};

  if (ask.name) {
    const name = str(raw.name);
    if (name.length < 1 || name.length > 60) throw new HttpsError("invalid-argument", "name");
    customer.name = name;
  }
  if (ask.phone) {
    const phone = str(raw.phone).replace(/[\s\-().]/g, "");
    if (!/^\+?\d{6,15}$/.test(phone)) throw new HttpsError("invalid-argument", "phone");
    customer.phone = phone;
  }
  if (ask.email) {
    const email = str(raw.email).toLowerCase();
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "email");
    }
    customer.email = email;
  }
  return customer;
}

// Alta de cliente: crea la tarjeta y devuelve el link para guardarla en el Wallet.
export const createCard = onCall({ secrets: [walletKey], memory: "512MiB" }, async (req) => {
  const { businessId, b } = await loadByCode(req.data?.code);
  if (isPaused(b)) throw new HttpsError("failed-precondition", "paused");
  if (enrollMissing(b).length > 0) {
    throw new HttpsError("failed-precondition", "El negocio todavía no terminó su tarjeta.");
  }
  if (req.data?.platform !== "google") {
    throw new HttpsError("unimplemented", "Apple Wallet todavía no está disponible.");
  }
  const customer = cleanCustomer(req.data?.customer, b.askFields ?? { name: true, phone: true, email: false });
  const consentVersion = String(req.data?.consentVersion ?? "");
  const consent = {
    marketing: req.data?.consent === true,
    at: Timestamp.now(),
    version: CONSENT_VERSION_RE.test(consentVersion) ? consentVersion : "desconocida",
  };
  // Una persona no suma decenas de tarjetas: 10 por hora por IP y 500 por día por negocio.
  await rateLimit(`createCard:ip:${clientIp(req)}`, 10, HOUR);
  await rateLimit(`createCard:biz:${businessId}`, 500, DAY);
  const cardRef = db().collection(`businesses/${businessId}/cards`).doc();

  try {
    if (!b.googleClassId) {
      const classId = await upsertLoyaltyClass(businessId, b);
      await db().doc(`businesses/${businessId}`).update({ googleClassId: classId });
    }

    // Código corto y único en el negocio (lo que codifica el QR y lee el escáner).
    const card = await db().runTransaction(async (tx) => {
      const barcodeValue = await reserveCardCode(db(), tx, businessId, cardRef.id);
      const data: CardDoc = {
        customer,
        stamps: 0,
        rewardsAvailable: 0,
        rewardsRedeemed: 0,
        barcodeValue,
        codeSuffix: cardCodeSuffix(barcodeValue),
        platform: "google",
        searchTokens: searchTokens(customer),
        consent,
        createdAt: Timestamp.now(),
      };
      tx.create(cardRef, {
        ...data,
        consent: { ...consent, at: FieldValue.serverTimestamp() },
        createdAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
      });
      return data;
    });

    const heroUrl = await new StampImages(businessId, b).urlFor(0);
    const objectId = await insertLoyaltyObject(businessId, cardRef.id, b, card, heroUrl);
    await cardRef.update({ googleObjectId: objectId });

    return { saveUrl: saveUrl([objectId]) };
  } catch (err) {
    logger.error("createCard falló", { businessId, cardId: cardRef.id, err });
    throw new HttpsError("internal", "No pudimos crear la tarjeta.");
  }
});
