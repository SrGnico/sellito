import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { CARD_CODE_LENGTH, CARD_CODE_SUFFIX_LENGTH, normalizeCardCode } from "../cards/codes";
import { pushCardToWallet } from "../cards/sync";
import { StampImages } from "../images/stamps";
import { accessLevel, canEdit, canOperate } from "../payments/access";
import type { BusinessDoc, CardDoc } from "../types";
import { appleSecrets } from "../wallet/apple";
import { walletKey } from "../wallet/google";
import { notifyDecision, type NotifyKind } from "../wallet/proximity";

// Escáner del local (SELLITO_SPEC.md §4.2 y §7): no usa Firebase Auth. Entra con el PIN del negocio
// y recibe un token de sesión que manda en cada llamada. Cambiar el PIN cierra todas las sesiones.

const db = () => getFirestore();
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const PIN_RE = /^\d{4,6}$/;
const MAX_FAILED = 5; // intentos de PIN antes de bloquear
const LOCK_MINUTES = 15;
const SESSION_DAYS = 90; // el celular del local queda logueado
export const STAMP_COOLDOWN_MINUTES = 5; // evita sumar dos veces por un doble escaneo

const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9]{1,40}$/.test(v);
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function checkPin(pin: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(pin, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

// ---------- PIN (lo elige el dueño desde el panel) ----------

export const setScannerPin = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  const { businessId, pin } = req.data ?? {};
  if (!validId(businessId)) throw new HttpsError("invalid-argument", "Negocio inválido.");
  if (typeof pin !== "string" || !PIN_RE.test(pin)) throw new HttpsError("invalid-argument", "pin");

  const ref = db().doc(`businesses/${businessId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get("ownerUid") !== uid) throw new HttpsError("permission-denied", "Este negocio no es tuyo.");
  // Con la suscripción vencida el panel queda en modo lectura: tampoco se cambia el PIN.
  if (!canEdit(accessLevel((snap.data() as BusinessDoc).subscription))) throw new HttpsError("failed-precondition", "subscription");

  await ref.update({
    scannerPinHash: await hashPin(pin),
    // Sube la versión: todas las sesiones abiertas del escáner dejan de valer.
    scannerPinVersion: FieldValue.increment(1),
  });
  await db().doc(`scannerGuards/${businessId}`).delete();
  return { ok: true };
});

// ---------- Sesión del escáner ----------

export const scannerLogin = onCall(async (req) => {
  const { businessId, pin } = req.data ?? {};
  if (!validId(businessId) || typeof pin !== "string") throw new HttpsError("invalid-argument", "Datos inválidos.");

  const bizSnap = await db().doc(`businesses/${businessId}`).get();
  const b = bizSnap.data() as (BusinessDoc & { scannerPinHash?: string; scannerPinVersion?: number }) | undefined;
  if (!b) throw new HttpsError("not-found", "No encontramos este negocio.");
  if (!b.scannerPinHash) throw new HttpsError("failed-precondition", "no-pin");

  // Bloqueo por intentos fallidos (por negocio).
  const guardRef = db().doc(`scannerGuards/${businessId}`);
  const guard = (await guardRef.get()).data() as { failed?: number; lockedUntil?: Timestamp } | undefined;
  if (guard?.lockedUntil && guard.lockedUntil.toMillis() > Date.now()) {
    const minutes = Math.ceil((guard.lockedUntil.toMillis() - Date.now()) / 60000);
    throw new HttpsError("resource-exhausted", `locked:${minutes}`);
  }

  if (!PIN_RE.test(pin) || !(await checkPin(pin, b.scannerPinHash))) {
    const failed = (guard?.failed ?? 0) + 1;
    const lock = failed >= MAX_FAILED;
    await guardRef.set({
      failed: lock ? 0 : failed,
      lockedUntil: lock ? Timestamp.fromMillis(Date.now() + LOCK_MINUTES * 60000) : null,
      lastFailAt: FieldValue.serverTimestamp(),
    });
    logger.warn("PIN del escáner incorrecto", { businessId, failed, lock });
    throw new HttpsError("permission-denied", lock ? `locked:${LOCK_MINUTES}` : `wrong:${MAX_FAILED - failed}`);
  }

  if (guard) await guardRef.delete();
  assertCanOperate(b);
  const token = randomBytes(32).toString("base64url");
  await db().doc(`scannerSessions/${sha256(token)}`).set({
    businessId,
    pinVersion: b.scannerPinVersion ?? 0,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + SESSION_DAYS * 86400000),
  });
  return { token, business: publicBusiness(b) };
});

function publicBusiness(b: BusinessDoc) {
  return {
    name: b.name,
    stampsRequired: b.rule?.stampsRequired ?? 0,
    rewardText: b.rule?.rewardText ?? "",
    design: { bgColor: b.design?.bgColor, stampIconId: b.design?.stampIconId, stampIconUrl: b.design?.stampIconUrl },
  };
}

// Sin pago el escáner se pausa (paso 8): no suma sellos ni canjea. Durante la gracia sigue andando.
// "no-subscription": el negocio todavía no se suscribió; "subscription": la suscripción venció.
function assertCanOperate(b: BusinessDoc) {
  const level = accessLevel(b.subscription);
  if (level === "none") throw new HttpsError("failed-precondition", "no-subscription");
  if (!canOperate(level)) throw new HttpsError("failed-precondition", "subscription");
}

type Session = { businessId: string; sessionId: string; b: BusinessDoc };

async function requireSession(token: unknown, businessId: unknown): Promise<Session> {
  if (typeof token !== "string" || token.length < 20 || !validId(businessId)) {
    throw new HttpsError("unauthenticated", "session");
  }
  const sessionId = sha256(token);
  const [session, biz] = await Promise.all([
    db().doc(`scannerSessions/${sessionId}`).get(),
    db().doc(`businesses/${businessId}`).get(),
  ]);
  const s = session.data();
  const b = biz.data() as BusinessDoc | undefined;
  if (!s || !b || s.businessId !== businessId || s.expiresAt.toMillis() < Date.now() || s.pinVersion !== (b.scannerPinVersion ?? 0)) {
    throw new HttpsError("unauthenticated", "session");
  }
  assertCanOperate(b);
  if (!b.rule) throw new HttpsError("failed-precondition", "no-card");
  return { businessId, sessionId, b };
}

// Datos del negocio para un escáner que ya tiene sesión (al recargar la página).
export const scannerSession = onCall(async (req) => {
  const { b } = await requireSession(req.data?.token, req.data?.businessId);
  return { business: publicBusiness(b) };
});

// ---------- Buscar la tarjeta ----------

type CardSummary = { cardId: string; name: string | null; stamps: number; total: number; minutesSinceLastStamp: number | null };

function summary(cardId: string, card: CardDoc, total: number): CardSummary {
  return {
    cardId,
    name: card.customer?.name ?? null,
    stamps: Math.min(card.stamps, total),
    total,
    minutesSinceLastStamp: card.lastStampAt ? Math.floor((Date.now() - card.lastStampAt.toMillis()) / 60000) : null,
  };
}

// Acepta el código completo (lo que lee la cámara) o los últimos 4 (lo que tipea el local).
// Con los últimos 4 puede haber más de una tarjeta: el escáner muestra los nombres para elegir.
export const scannerLookup = onCall(async (req) => {
  const { businessId, b } = await requireSession(req.data?.token, req.data?.businessId);
  const total = b.rule!.stampsRequired;
  const code = normalizeCardCode(String(req.data?.code ?? ""));

  if (code.length === CARD_CODE_LENGTH) {
    const link = await db().doc(`businesses/${businessId}/codes/${code}`).get();
    if (!link.exists) return { cards: [] };
    const cardId = link.get("cardId") as string;
    const card = await db().doc(`businesses/${businessId}/cards/${cardId}`).get();
    return { cards: card.exists ? [summary(cardId, card.data() as CardDoc, total)] : [] };
  }
  if (code.length === CARD_CODE_SUFFIX_LENGTH) {
    const snap = await db().collection(`businesses/${businessId}/cards`).where("codeSuffix", "==", code).limit(10).get();
    return { cards: snap.docs.map((d) => summary(d.id, d.data() as CardDoc, total)) };
  }
  throw new HttpsError("invalid-argument", "code");
});

// ---------- Sumar sello / canjear premio ----------

export const scannerStamp = onCall({ secrets: [walletKey, ...appleSecrets], memory: "512MiB" }, async (req) => {
  const { businessId, sessionId, b } = await requireSession(req.data?.token, req.data?.businessId);
  const { cardId, action, force } = req.data ?? {};
  if (!validId(cardId) || (action !== "add" && action !== "redeem")) throw new HttpsError("invalid-argument", "Datos inválidos.");
  const total = b.rule!.stampsRequired;
  const cardRef = db().doc(`businesses/${businessId}/cards/${cardId}`);
  let notify: NotifyKind | undefined;

  const card = await db().runTransaction(async (tx) => {
    notify = undefined; // la transacción puede reintentarse
    const snap = await tx.get(cardRef);
    if (!snap.exists) throw new HttpsError("not-found", "card");
    const c = snap.data() as CardDoc;
    const stamps = Math.min(c.stamps, total);
    let next: Record<string, unknown>;

    if (action === "add") {
      if (stamps >= total) throw new HttpsError("failed-precondition", "reward-ready");
      const since = c.lastStampAt ? (Date.now() - c.lastStampAt.toMillis()) / 60000 : Infinity;
      if (since < STAMP_COOLDOWN_MINUTES && force !== true) {
        throw new HttpsError("resource-exhausted", `cooldown:${Math.floor(since)}`);
      }
      next = { stamps: stamps + 1, lastStampAt: FieldValue.serverTimestamp(), lastActivityAt: FieldValue.serverTimestamp() };
      if (stamps + 1 >= total) next.rewardsAvailable = 1;
    } else {
      if (stamps < total) throw new HttpsError("failed-precondition", "no-reward");
      next = { stamps: 0, rewardsAvailable: 0, rewardsRedeemed: FieldValue.increment(1), lastActivityAt: FieldValue.serverTimestamp() };
    }

    // Aviso al cliente: al sumar (si no completa) o al completar la tarjeta, dentro del cupo diario.
    if (action === "add") {
      notify = (next.stamps as number) >= total ? "complete" : "stamp";
      const decision = notifyDecision(c, notify);
      if (decision.notify) next.walletNotifyAt = decision.log;
      else notify = undefined;
    }

    tx.update(cardRef, next);
    tx.create(db().collection(`businesses/${businessId}/stamps`).doc(), {
      cardId,
      type: action,
      forced: action === "add" && force === true,
      at: FieldValue.serverTimestamp(),
      by: `scanner:${sessionId.slice(0, 12)}`,
      stampsAfter: next.stamps,
    });
    return { ...c, stamps: next.stamps as number };
  });

  // El Wallet se actualiza después de guardar: si Google falla, el sello ya quedó registrado.
  try {
    await pushCardToWallet(businessId, cardId, b, card, new StampImages(businessId, b), notify);
  } catch (err) {
    logger.error("scannerStamp: no se pudo actualizar el Wallet", { businessId, cardId, err });
  }
  return { card: summary(cardId, { ...card, lastStampAt: action === "add" ? Timestamp.now() : card.lastStampAt }, total) };
});
