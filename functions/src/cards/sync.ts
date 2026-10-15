import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { StampImages } from "../images/stamps";
import { accessLevel, canOperate } from "../payments/access";
import type { BusinessDoc, CardDoc } from "../types";
import { appleSecrets, pushApplePass } from "../wallet/apple";
import { addLoyaltyMessage, patchLoyaltyObject, upsertLoyaltyClass, walletKey } from "../wallet/google";
import { proximityText, type NotifyKind } from "../wallet/proximity";
import { cardCodeSuffix, reserveCardCode } from "./codes";

const db = () => getFirestore();

// Lleva una tarjeta ya emitida al estado actual: contador, imagen de sellos, premio y código.
// La usan el escáner (paso 5), los cambios de diseño y la prueba de sellos.
// `notify` (solo el escáner, ya filtrado por notifyDecision): "stamp" avisa el cambio de contador;
// "complete" manda el mensaje de tarjeta completa.
export async function pushCardToWallet(businessId: string, cardId: string, b: BusinessDoc, card: CardDoc, images: StampImages, notify?: NotifyKind) {
  // Apple: el pase se arma cuando el iPhone lo pide; acá solo se marca el cambio y se avisa por APNs.
  if (card.platform === "apple") return pushApplePass(businessId, cardId, notify !== undefined);
  if (card.platform !== "google" || !card.googleObjectId) return;
  await patchLoyaltyObject(cardId, b, card, await images.urlFor(card.stamps), notify === "stamp");
  if (notify === "complete") {
    try {
      await addLoyaltyMessage(cardId, "¡Completaste tu tarjeta!", `${proximityText(b, card.stamps)}: ${b.rule!.rewardText}.`, true);
    } catch (err) {
      // Si Google rechaza el aviso (cupo diario), la tarjeta igual quedó actualizada.
      logger.warn("No se pudo mandar el aviso de tarjeta completa", { cardId, err });
    }
  }
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
      await pushCardToWallet(businessId, doc.id, b, card, images);
      updated++;
    } catch (err) {
      failed++;
      logger.error("No se pudo sincronizar la tarjeta", { businessId, cardId: doc.id, err });
    }
  }
  return { updated, failed };
}

async function ownedBusiness(uid: string | undefined, businessId: unknown, superadmin = false): Promise<BusinessDoc> {
  if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  if (typeof businessId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(businessId)) {
    throw new HttpsError("invalid-argument", "Negocio inválido.");
  }
  const snap = await db().doc(`businesses/${businessId}`).get();
  if (!snap.exists || (snap.get("ownerUid") !== uid && !superadmin)) throw new HttpsError("permission-denied", "Este negocio no es tuyo.");
  const b = snap.data() as BusinessDoc;
  // Con la suscripción vencida las actualizaciones del Wallet quedan en pausa hasta reactivar.
  const level = accessLevel(b.subscription);
  if (level !== "none" && !canOperate(level)) throw new HttpsError("failed-precondition", "subscription");
  return b;
}

// "Actualizar tarjetas": vuelve a mandar todas las tarjetas al Wallet. Lo puede pedir el dueño o el
// super admin (desde /admin, por ejemplo después de un cambio visual para todos los negocios).
export const resyncCards = onCall({ secrets: [walletKey, ...appleSecrets], memory: "512MiB", timeoutSeconds: 300 }, async (req) => {
  const businessId = req.data?.businessId as string;
  const b = await ownedBusiness(req.auth?.uid, businessId, req.auth?.token.superadmin === true);
  if (!b.rule) throw new HttpsError("failed-precondition", "El negocio todavía no terminó su tarjeta.");
  if (b.googleClassId) await upsertLoyaltyClass(businessId, b);
  return resyncBusinessCards(businessId, b);
});
