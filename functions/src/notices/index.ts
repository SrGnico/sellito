import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { accessLevel, canOperate } from "../payments/access";
import { DAY, rateLimit } from "../security/rateLimit";
import type { BusinessDoc, CardDoc } from "../types";
import { appleSecrets, pushApplePass } from "../wallet/apple";
import { addLoyaltyMessage, walletKey } from "../wallet/google";
import { notifyDecision } from "../wallet/proximity";

// Avisos del negocio a sus clientes (Panel → Avisos): llegan como notificación a la tarjeta del Wallet,
// solo a quienes aceptaron recibir novedades (consent.marketing). Un aviso por día por negocio.
//   Google: mensaje en la tarjeta con TEXT_AND_NOTIFY (dentro del tope diario de avisos de cada tarjeta).
//   Apple: campo "Novedades" del pase con changeMessage → el iPhone avisa al cambiar.

const db = () => getFirestore();
export const NOTICE_TITLE_MAX = 40;
export const NOTICE_BODY_MAX = 140;

export const sendNotice = onCall({ enforceAppCheck: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  const { businessId } = req.data ?? {};
  const title = typeof req.data?.title === "string" ? req.data.title.trim() : "";
  const body = typeof req.data?.body === "string" ? req.data.body.trim() : "";
  if (typeof businessId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(businessId)) throw new HttpsError("invalid-argument", "Negocio inválido.");
  if (!title || title.length > NOTICE_TITLE_MAX || !body || body.length > NOTICE_BODY_MAX) throw new HttpsError("invalid-argument", "text");

  const snap = await db().doc(`businesses/${businessId}`).get();
  const b = snap.data() as BusinessDoc | undefined;
  if (!b || b.ownerUid !== uid) throw new HttpsError("permission-denied", "Este negocio no es tuyo.");
  if (!canOperate(accessLevel(b.subscription))) throw new HttpsError("failed-precondition", "subscription");
  await rateLimit(`notice:${businessId}`, 1, DAY);

  const ref = await db().collection(`businesses/${businessId}/notices`).add({
    title,
    body,
    status: "sending",
    createdAt: FieldValue.serverTimestamp(),
    by: uid,
  });
  return { id: ref.id };
});

// Envío en segundo plano (puede haber cientos de tarjetas).
export const deliverNotice = onDocumentCreated(
  { document: "businesses/{businessId}/notices/{noticeId}", secrets: [walletKey, ...appleSecrets], memory: "512MiB", timeoutSeconds: 540 },
  async (event) => {
    const { businessId } = event.params;
    const notice = event.data?.data() as { title: string; body: string } | undefined;
    if (!notice || !event.data) return;

    const cards = await db().collection(`businesses/${businessId}/cards`).where("consent.marketing", "==", true).get();
    const counts = { recipients: cards.size, google: 0, apple: 0, notified: 0, failed: 0 };

    for (const doc of cards.docs) {
      const card = doc.data() as CardDoc;
      try {
        const r = await sendCardMessage(businessId, doc.id, card, notice.title, notice.body);
        if (r === "google" || r === "google-silent") counts.google++;
        if (r === "apple") counts.apple++;
        if (r === "google" || r === "apple") counts.notified++;
      } catch (err) {
        counts.failed++;
        logger.warn("No se pudo enviar el aviso a una tarjeta", { businessId, cardId: doc.id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    await event.data.ref.update({ status: "sent", counts, sentAt: FieldValue.serverTimestamp() });
    logger.info("Aviso enviado", { businessId, ...counts });
  },
);

// Mensaje del negocio a una tarjeta (avisos y saludo de cumpleaños).
//   Google: mensaje en la tarjeta con aviso, si entra en el tope diario ("google"); si no, sin aviso.
//   Apple: campo "Novedades" del pase con changeMessage (el iPhone avisa al cambiar).
export async function sendCardMessage(
  businessId: string,
  cardId: string,
  card: CardDoc,
  title: string,
  body: string,
): Promise<"google" | "google-silent" | "apple" | "none"> {
  const ref = db().doc(`businesses/${businessId}/cards/${cardId}`);
  if (card.platform === "google" && card.googleObjectId) {
    // Respeta el tope de 3 avisos por tarjeta por día (guarda un lugar para "tarjeta completa").
    const decision = notifyDecision(card, "stamp");
    await addLoyaltyMessage(cardId, title, body, decision.notify);
    if (!decision.notify) return "google-silent";
    await ref.update({ walletNotifyAt: decision.log });
    return "google";
  }
  if (card.platform === "apple") {
    await ref.update({ appleNotice: { title, body, at: Date.now() } });
    await pushApplePass(businessId, cardId, false);
    return "apple";
  }
  return "none";
}
