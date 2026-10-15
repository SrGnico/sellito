import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { StampImages } from "../images/stamps";
import type { BusinessDoc, CardDoc } from "../types";
import { patchLoyaltyObject, upsertLoyaltyClass, walletKey } from "../wallet/google";
import { cardCodeSuffix, reserveCardCode } from "./codes";

const db = () => getFirestore();

// Lleva una tarjeta ya emitida al estado actual: contador, imagen de sellos, premio y código.
// La usan el escáner (paso 5), los cambios de diseño y la prueba de sellos.
export async function pushCardToWallet(cardId: string, b: BusinessDoc, card: CardDoc, images: StampImages) {
  if (card.platform !== "google" || !card.googleObjectId) return;
  await patchLoyaltyObject(cardId, b, card, await images.urlFor(card.stamps));
}

// Tarjetas creadas con el formato viejo (S1.{id}.{secreto}): les asigna un código corto.
// También completa `codeSuffix` en las que no lo tienen.
async function migrateLegacyCode(businessId: string, cardId: string): Promise<string> {
  const cardRef = db().doc(`businesses/${businessId}/cards/${cardId}`);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(cardRef);
    const current = snap.get("barcodeValue") as string;
    if (!current.startsWith("S1.")) {
      if (!snap.get("codeSuffix")) tx.update(cardRef, { codeSuffix: cardCodeSuffix(current) });
      return current;
    }
    const code = await reserveCardCode(db(), tx, businessId, cardId);
    tx.update(cardRef, { barcodeValue: code, codeSuffix: cardCodeSuffix(code) });
    return code;
  });
}

// Actualiza todas las tarjetas del negocio (por ejemplo, después de cambiar el diseño o la regla).
export async function resyncBusinessCards(businessId: string, b: BusinessDoc): Promise<{ updated: number; failed: number }> {
  const images = new StampImages(businessId, b);
  const snap = await db().collection(`businesses/${businessId}/cards`).get();
  let updated = 0;
  let failed = 0;
  for (const doc of snap.docs) {
    try {
      const card = doc.data() as CardDoc;
      card.barcodeValue = await migrateLegacyCode(businessId, doc.id);
      await pushCardToWallet(doc.id, b, card, images);
      updated++;
    } catch (err) {
      failed++;
      logger.error("No se pudo sincronizar la tarjeta", { businessId, cardId: doc.id, err });
    }
  }
  return { updated, failed };
}

async function ownedBusiness(uid: string | undefined, businessId: unknown): Promise<BusinessDoc> {
  if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  if (typeof businessId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(businessId)) {
    throw new HttpsError("invalid-argument", "Negocio inválido.");
  }
  const snap = await db().doc(`businesses/${businessId}`).get();
  if (!snap.exists || snap.get("ownerUid") !== uid) throw new HttpsError("permission-denied", "Este negocio no es tuyo.");
  return snap.data() as BusinessDoc;
}

// Botón "Actualizar tarjetas" del panel: vuelve a mandar todas las tarjetas al Wallet.
export const resyncCards = onCall({ secrets: [walletKey], memory: "512MiB", timeoutSeconds: 300 }, async (req) => {
  const businessId = req.data?.businessId as string;
  const b = await ownedBusiness(req.auth?.uid, businessId);
  if (!b.rule) throw new HttpsError("failed-precondition", "El negocio todavía no terminó su tarjeta.");
  if (b.googleClassId) await upsertLoyaltyClass(businessId, b);
  return resyncBusinessCards(businessId, b);
});

// SOLO PARA PROBAR (el panel lo muestra en `npm run dev`): fija el contador de una tarjeta.
// El escáner real (paso 5) va a sumar sellos con PIN, rate limit y log de quién lo cargó.
export const testSetStamps = onCall({ secrets: [walletKey], memory: "512MiB" }, async (req) => {
  const { businessId, cardId, stamps } = req.data ?? {};
  const b = await ownedBusiness(req.auth?.uid, businessId);
  if (!b.rule) throw new HttpsError("failed-precondition", "El negocio todavía no terminó su tarjeta.");
  if (typeof cardId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(cardId)) {
    throw new HttpsError("invalid-argument", "Tarjeta inválida.");
  }
  if (!Number.isInteger(stamps) || stamps < 0 || stamps > b.rule.stampsRequired) {
    throw new HttpsError("invalid-argument", "Cantidad de sellos inválida.");
  }

  const cardRef = db().doc(`businesses/${businessId}/cards/${cardId}`);
  const snap = await cardRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "No encontramos la tarjeta.");
  const card = { ...(snap.data() as CardDoc), stamps };

  await cardRef.update({ stamps, lastStampAt: FieldValue.serverTimestamp() });
  await db().collection(`businesses/${businessId}/stamps`).add({
    cardId,
    type: "test",
    at: FieldValue.serverTimestamp(),
    by: `owner:${req.auth!.uid}`,
    stampsAfter: stamps,
  });
  try {
    await pushCardToWallet(cardId, b, card, new StampImages(businessId, b));
  } catch (err) {
    logger.error("testSetStamps: no se pudo actualizar el Wallet", { businessId, cardId, err });
    throw new HttpsError("internal", "Se guardó el sello pero no pudimos actualizar el Wallet.");
  }
  return { stamps };
});
