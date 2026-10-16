import { randomBytes } from "node:crypto";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { enrollMissing, type BusinessDoc, type CardDoc, type Customer } from "../types";
import { StampImages } from "../images/stamps";
import { saveUrl, upsertLoyaltyClass, upsertLoyaltyObject, walletKey } from "../wallet/google";
import { accessLevel, isDraft } from "../payments/access";
import { cardCodeSuffix, reserveCardCode } from "./codes";
import { identityKeys, searchTokens } from "./search";
import { clientIp, DAY, HOUR, rateLimit } from "../security/rateLimit";
import { appleDownloadUrl, newAppleAuthToken } from "../wallet/apple";
import { birthdayFields, birthdayPerk, parseBirthday } from "../birthday/rules";

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
// En borrador no hay QR: se genera al activar (payments/state.ts).
export const ensureEnrollCode = onCall({ enforceAppCheck: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  const businessId = req.data?.businessId;
  if (typeof businessId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(businessId)) {
    throw new HttpsError("invalid-argument", "Negocio inválido.");
  }
  const b = (await db().doc(`businesses/${businessId}`).get()).data() as BusinessDoc | undefined;
  if (!b || b.ownerUid !== uid) throw new HttpsError("permission-denied", "Este negocio no es tuyo.");
  if (isDraft(b)) throw new HttpsError("failed-precondition", "draft");
  return { code: await assignEnrollCode(businessId) };
});

// Devuelve el código de alta del negocio, creándolo si no tiene. Idempotente.
export async function assignEnrollCode(businessId: string): Promise<string> {
  const bizRef = db().doc(`businesses/${businessId}`);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const result = await db().runTransaction(async (tx) => {
      const biz = await tx.get(bizRef);
      if (!biz.exists) throw new HttpsError("not-found", "No encontramos este negocio.");
      const existing = (biz.data() as BusinessDoc).enrollCode;
      if (existing) return existing;
      const codeRef = db().doc(`enrollCodes/${code}`);
      if ((await tx.get(codeRef)).exists) return null; // choque: probar otro
      tx.create(codeRef, { businessId, createdAt: FieldValue.serverTimestamp() });
      tx.update(bizRef, { enrollCode: code });
      return code;
    });
    if (result) return result;
  }
  throw new HttpsError("internal", "No pudimos generar el código. Intentá de nuevo.");
}

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
function enrollInfoOf(b: BusinessDoc) {
  if (isDraft(b)) return { ready: false, name: b.name }; // todavía no activó la tarjeta
  if (isPaused(b)) return { ready: false, paused: true, name: b.name };
  if (enrollMissing(b).length > 0) return { ready: false, name: b.name };
  return {
    ready: true,
    name: b.name,
    design: b.design ?? {},
    rule: b.rule,
    askFields: b.askFields ?? { name: true, phone: true, email: false },
    birthdayPerk: birthdayPerk(b), // "Te regalamos … el día de tu cumple" (o null)
  };
}

// Versión anterior (callable con App Check). Queda para páginas abiertas antes del cambio.
export const getEnrollInfo = onCall({ enforceAppCheck: true }, async (req) => enrollInfoOf((await loadByCode(req.data?.code)).b));

// GET API_URL/enrollInfo/{código}: lo mismo, sin App Check (son datos públicos, los mismos que muestra
// la tarjeta) y cacheable en el CDN de Hosting, para que la página de alta cargue al instante.
// Crear la tarjeta (createCard) sí exige App Check.
export const enrollInfo = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  const code = req.path.split("/").filter(Boolean).pop();
  try {
    const { b } = await loadByCode(code);
    res.set("Cache-Control", "public, max-age=30, s-maxage=60");
    res.json(enrollInfoOf(b));
  } catch (err) {
    if (err instanceof HttpsError && err.code === "not-found") {
      res.set("Cache-Control", "public, max-age=30, s-maxage=60");
      res.status(404).json({ error: "not-found" });
      return;
    }
    logger.error("enrollInfo falló", { code, err });
    res.status(500).json({ error: "internal" });
  }
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
  // Cumpleaños: opcional para el cliente aunque el negocio lo pida (vacío = no lo cargó).
  if (ask.birthday && raw.birthday) {
    const birthday = parseBirthday(raw.birthday);
    if (!birthday) throw new HttpsError("invalid-argument", "birthday");
    customer.birthday = birthday;
  }
  return customer;
}

// Alta de cliente: crea la tarjeta y devuelve el link para guardarla en el Wallet.
export const createCard = onCall({ enforceAppCheck: true, secrets: [walletKey], memory: "512MiB" }, async (req) => {
  const { businessId, b } = await loadByCode(req.data?.code);
  if (isDraft(b)) throw new HttpsError("failed-precondition", "El negocio todavía no activó su tarjeta.");
  if (isPaused(b)) throw new HttpsError("failed-precondition", "paused");
  if (enrollMissing(b).length > 0) {
    throw new HttpsError("failed-precondition", "El negocio todavía no terminó su tarjeta.");
  }
  const platform = req.data?.platform;
  if (platform !== "google" && platform !== "apple") throw new HttpsError("invalid-argument", "platform");
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
  const keys = identityKeys(customer);

  try {
    if (platform === "google" && !b.googleClassId) {
      const classId = await upsertLoyaltyClass(businessId, b);
      await db().doc(`businesses/${businessId}`).update({ googleClassId: classId });
    }

    // ¿Ya tiene tarjeta en este negocio (mismo teléfono o mail)? Se la devolvemos con sus sellos.
    const existing = await findExistingCard(businessId, keys);
    if (existing) {
      // Si antes no había cargado el cumpleaños y ahora sí, se completa.
      const prev = existing.data() as CardDoc;
      if (customer.birthday && !prev.customer?.birthday) {
        await existing.ref.update({ "customer.birthday": customer.birthday, ...birthdayFields(customer.birthday) });
      }
      const link = await reissueCard(businessId, b, existing.id, existing.data() as CardDoc, platform);
      return { ...link, existing: true, stamps: (existing.data() as CardDoc).stamps };
    }

    // Código corto y único en el negocio (lo que codifica el QR y lee el escáner).
    const card = await db().runTransaction(async (tx) => {
      const barcodeValue = await reserveCardCode(db(), tx, businessId, cardRef.id);
      const data: CardDoc = {
        customer,
        stamps: b.demo ? 1 : 0, // la tarjeta de ejemplo de la landing arranca con un sello de regalo
        rewardsAvailable: 0,
        rewardsRedeemed: 0,
        barcodeValue,
        codeSuffix: cardCodeSuffix(barcodeValue),
        platform,
        ...(platform === "apple" ? { appleAuthToken: newAppleAuthToken(), appleUpdatedAt: Date.now() } : {}),
        searchTokens: searchTokens(customer),
        ...keys,
        ...birthdayFields(customer.birthday),
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

    // Apple: el .pkpass se arma al bajarlo (applePass/download), con el token de esta tarjeta.
    if (platform === "apple") return { pkpassUrl: appleDownloadUrl(businessId, cardRef.id, card.appleAuthToken!) };

    const heroUrl = await new StampImages(businessId, b).urlFor(card.stamps);
    const objectId = await upsertLoyaltyObject(businessId, cardRef.id, b, card, heroUrl);
    await cardRef.update({ googleObjectId: objectId });

    return { saveUrl: saveUrl([objectId]) };
  } catch (err) {
    logger.error("createCard falló", { businessId, cardId: cardRef.id, error: err instanceof Error ? err.message : String(err) });
    throw new HttpsError("internal", "No pudimos crear la tarjeta.");
  }
});

async function findExistingCard(businessId: string, keys: { phoneKey?: string; emailKey?: string }) {
  const cards = db().collection(`businesses/${businessId}/cards`);
  for (const [field, value] of Object.entries(keys)) {
    if (!value) continue;
    const snap = await cards.where(field, "==", value).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

// Vuelve a emitir una tarjeta existente en la plataforma pedida (puede haber cambiado de celular).
async function reissueCard(
  businessId: string,
  b: BusinessDoc,
  cardId: string,
  card: CardDoc,
  platform: "google" | "apple",
): Promise<{ saveUrl?: string; pkpassUrl?: string }> {
  const ref = db().doc(`businesses/${businessId}/cards/${cardId}`);
  if (platform === "apple") {
    const token = card.appleAuthToken ?? newAppleAuthToken();
    await ref.update({ platform: "apple", appleAuthToken: token, appleUpdatedAt: Date.now() });
    return { pkpassUrl: appleDownloadUrl(businessId, cardId, token) };
  }
  const heroUrl = await new StampImages(businessId, b).urlFor(card.stamps);
  const objectId = await upsertLoyaltyObject(businessId, cardId, b, card, heroUrl);
  await ref.update({ platform: "google", googleObjectId: objectId });
  return { saveUrl: saveUrl([objectId]) };
}
