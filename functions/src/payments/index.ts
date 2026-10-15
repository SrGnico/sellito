import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { APP_NAME, APP_URL } from "../config";
import type { BusinessDoc } from "../types";
import { accessLevel, DAY_MS } from "./access";
import {
  createPreapproval,
  getAuthorizedPayment,
  getPreapproval,
  mpAccessToken,
  mpWebhookSecret,
  validSignature,
} from "./mercadopago";
import { DEFAULT_PLAN, loadPlan, loadPlans } from "./plans";
import { markActive, markCancelled, markPastDue } from "./state";

const db = () => getFirestore();

// Suscribirse, reactivar o cambiar el medio de pago: crea una suscripción nueva en Mercado Pago
// y devuelve el link de pago. La anterior se da de baja recién cuando la nueva queda autorizada.
export const createSubscription = onCall({ secrets: [mpAccessToken] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  const { businessId } = req.data ?? {};
  const planId = typeof req.data?.plan === "string" ? req.data.plan : DEFAULT_PLAN;
  if (typeof businessId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(businessId)) {
    throw new HttpsError("invalid-argument", "Negocio inválido.");
  }
  const ref = db().doc(`businesses/${businessId}`);
  const snap = await ref.get();
  const b = snap.data() as BusinessDoc | undefined;
  if (!b || b.ownerUid !== uid) throw new HttpsError("permission-denied", "Este negocio no es tuyo.");
  if (b.subscription?.status === "active" && !b.subscription.cancelAtPeriodEnd) {
    throw new HttpsError("failed-precondition", "already-active");
  }

  const plan = await loadPlan(planId);
  // Mercado Pago pide el mail de la cuenta de MP que va a pagar (puede no ser el del panel).
  const given = typeof req.data?.payerEmail === "string" ? req.data.payerEmail.trim().toLowerCase() : "";
  if (given && (given.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(given))) {
    throw new HttpsError("invalid-argument", "payer-email");
  }
  const email = given || (await getAuth().getUser(uid)).email;
  if (!email) throw new HttpsError("failed-precondition", "no-email");

  try {
    const p = await createPreapproval({
      businessId,
      reason: `${APP_NAME.value()} · ${b.name}`.slice(0, 120),
      payerEmail: email,
      plan,
      backUrl: `${APP_URL.value()}/panel?suscripcion=ok`,
    });
    await ref.update({
      "subscription.pendingPreapprovalId": p.id,
      "subscription.pendingPlan": planId,
      "subscription.pendingAmount": plan.amount,
      "subscription.currency": plan.currency,
      "subscription.payerEmail": email,
    });
    return { url: p.init_point };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("createSubscription falló", { businessId, error: message });
    // Credenciales de prueba con un mail real (o al revés): MP no deja mezclarlos.
    if (message.includes("must be real or test users")) throw new HttpsError("failed-precondition", "payer-test-mismatch");
    throw new HttpsError("internal", "No pudimos iniciar el pago. Intentá de nuevo.");
  }
});

// Webhook de Mercado Pago (API_URL/mpWebhook, configurado en el panel de MP).
// Nunca confía en el cuerpo: consulta el estado real a la API.
export const mpWebhook = onRequest({ secrets: [mpAccessToken, mpWebhookSecret] }, async (req, res) => {
  const type = String(req.query.type ?? req.query.topic ?? req.body?.type ?? "");
  const dataId = String(req.query["data.id"] ?? req.body?.data?.id ?? "");
  if (!dataId) {
    res.status(200).send("ignored");
    return;
  }
  if (!validSignature(req.get("x-signature"), req.get("x-request-id"), dataId)) {
    logger.warn("mpWebhook: firma inválida", { type, dataId });
    res.status(401).send("invalid signature");
    return;
  }

  try {
    if (type === "subscription_preapproval") {
      const p = await getPreapproval(dataId);
      const businessId = p.external_reference;
      if (businessId) {
        if (p.status === "authorized") await activateUnlessFailed(businessId, p.id);
        else if (p.status === "cancelled") await markCancelled(businessId, p);
        else if (p.status === "paused") await markPastDue(businessId, p.id);
      }
    } else if (type === "subscription_authorized_payment") {
      const payment = await getAuthorizedPayment(dataId);
      const p = await getPreapproval(payment.preapproval_id);
      const businessId = p.external_reference;
      const status = payment.payment?.status;
      if (businessId && status === "approved") await markActive(businessId, p);
      else if (businessId && (status === "rejected" || payment.status === "recycling")) await markPastDue(businessId, p.id);
    }
    res.status(200).send("ok");
  } catch (err) {
    // 500: Mercado Pago reintenta el aviso más tarde. La tarea diaria cubre lo que se pierda.
    logger.error("mpWebhook falló", { type, dataId, err });
    res.status(500).send("error");
  }
});

// "authorized" solo significa que la suscripción existe y tiene medio de pago. Si esta misma
// suscripción es la que tuvo el cobro fallido, se espera a un cobro aprobado para salir de la mora.
async function activateUnlessFailed(businessId: string, preapprovalId: string) {
  const b = (await db().doc(`businesses/${businessId}`).get()).data() as BusinessDoc | undefined;
  if (!b) return;
  if (b.subscription?.failedPreapprovalId === preapprovalId && accessLevel(b.subscription) !== "full") return;
  await markActive(businessId, await getPreapproval(preapprovalId));
}

// Prueba gratis: si config/plans tiene trialDays > 0, el negocio nuevo arranca en prueba.
export const startTrial = onDocumentCreated("businesses/{businessId}", async (event) => {
  const b = event.data?.data() as BusinessDoc | undefined;
  if (!b || b.subscription) return;
  const { trialDays = 0 } = await loadPlans();
  if (!(trialDays > 0)) return;
  await event.data!.ref.update({
    subscription: {
      status: "trial",
      trialEndsAt: Timestamp.fromMillis(Date.now() + trialDays * DAY_MS),
      notices: {},
      updatedAt: Timestamp.now(),
    },
  });
});
