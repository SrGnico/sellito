import { getAuth } from "firebase-admin/auth";
import { sendSubscribeEvent } from "../meta/capi";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { notifyAdmin, sendMail } from "../mail";
import { assignEnrollCode } from "../cards/enroll";
import { enrollMissing, type BusinessDoc, type Subscription } from "../types";
import { upsertLoyaltyClass } from "../wallet/google";
import { DAY_MS, GRACE_DAYS } from "./access";
import { cancelPreapproval, type Preapproval } from "./mercadopago";

// Cambios de estado de la suscripción. Los usan el webhook de Mercado Pago y la tarea diaria;
// todos son idempotentes (si llegan dos avisos iguales, el segundo no hace nada).

const db = () => getFirestore();
const bizRef = (id: string) => db().doc(`businesses/${id}`);

type Change = { b: BusinessDoc; sub: Subscription } | null;

// Lee el negocio, decide el cambio y lo guarda en una transacción. `decide` devuelve los campos
// nuevos de `subscription` (se reemplaza entero) o null si no hay nada que hacer.
async function change(businessId: string, decide: (sub: Subscription, b: BusinessDoc) => Subscription | null): Promise<Change> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(bizRef(businessId));
    if (!snap.exists) return null;
    const b = snap.data() as BusinessDoc;
    const next = decide(b.subscription ?? {}, b);
    if (!next) return null;
    const sub = { ...next, updatedAt: Timestamp.now() };
    tx.update(bizRef(businessId), { subscription: sub });
    return { b, sub };
  });
}

const nextPaymentDate = (p: Preapproval) => (p.next_payment_date ? Timestamp.fromDate(new Date(p.next_payment_date)) : undefined);

// Cobro aprobado o suscripción autorizada: queda al día y se limpia todo lo de la mora.
export async function markActive(businessId: string, p: Preapproval): Promise<void> {
  let oldPreapproval: string | undefined;
  const res = await change(businessId, (s) => {
    // Solo vale la suscripción vigente o el checkout en curso; las viejas se ignoran.
    if (p.id !== s.mpPreapprovalId && p.id !== s.pendingPreapprovalId) return null;
    const promoting = p.id === s.pendingPreapprovalId;
    if (promoting && s.mpPreapprovalId && s.mpPreapprovalId !== p.id) oldPreapproval = s.mpPreapprovalId;
    const next: Subscription = {
      status: "active",
      plan: promoting ? s.pendingPlan : s.plan,
      amount: promoting ? s.pendingAmount : s.amount,
      currency: p.auto_recurring?.currency_id ?? s.currency,
      mpPreapprovalId: p.id,
      mpStatus: p.status,
      currentPeriodEnd: nextPaymentDate(p) ?? s.currentPeriodEnd,
      trialEndsAt: s.trialEndsAt,
      draftAt: s.draftAt,
      activatedAt: s.activatedAt ?? Timestamp.now(), // solo la primera vez
    };
    // Cobró la suscripción vieja mientras había un checkout abierto: se conserva para que, si se
    // completa, reemplace a la vieja (y la vieja se cancele) en vez de cobrar las dos.
    if (!promoting && s.pendingPreapprovalId) {
      Object.assign(next, { pendingPreapprovalId: s.pendingPreapprovalId, pendingPlan: s.pendingPlan, pendingAmount: s.pendingAmount });
    }
    return stripUndefined(next);
  });
  if (res) logger.info("Suscripción al día", { businessId, preapproval: p.id });
  // Confirmación solo al pasar a activa (primer pago o reactivación), no en cada renovación.
  if (res && res.b.subscription?.status !== "active") {
    await enableBusiness(businessId);
    // Meta (API de Conversiones): mismo event_id que el Pixel del panel.
    await sendSubscribeEvent(businessId, res.b, p.id, await ownerEmailOf(res.b.ownerUid), res.sub.amount, res.sub.currency);
    try {
      await sendMail(res.b.ownerUid, "activated", { businessName: res.b.name });
    } catch (err) {
      logger.error("No se pudo encolar la confirmación de la suscripción", { businessId, err });
    }
    const amount = res.sub.amount ? `$${res.sub.amount.toLocaleString("es-AR")} por mes` : "monto sin dato";
    await notifyAdmin(
      res.b.subscription?.status === "past_due" ? `Pagó y volvió al día: ${res.b.name}` : `💰 Nueva suscripción: ${res.b.name}`,
      [`${res.b.name} tiene la suscripción activa (${amount}).`, `ID: ${businessId}`],
    );
  }
  // La suscripción anterior (la del cobro que falló) se da de baja para que no cobre dos veces.
  if (oldPreapproval) {
    try {
      await cancelPreapproval(oldPreapproval);
    } catch (err) {
      logger.error("No se pudo cancelar la suscripción anterior en Mercado Pago", { businessId, oldPreapproval, err });
    }
  }
}

// Recién al activar se habilita lo que en borrador no existe: el código del QR y la clase de Google Wallet.
// Idempotente (al reactivar ya están). Si algo falla no se corta la activación: el QR se vuelve a pedir
// desde el panel y la clase se crea con la primera tarjeta (cards/enroll.ts).
async function enableBusiness(businessId: string): Promise<void> {
  try {
    await assignEnrollCode(businessId);
  } catch (err) {
    logger.error("No se pudo crear el código del QR al activar", { businessId, err });
  }
  try {
    const b = (await bizRef(businessId).get()).data() as BusinessDoc | undefined;
    if (!b || b.googleClassId || enrollMissing(b).length > 0) return; // sin logo o premio, Google no acepta la clase
    const classId = await upsertLoyaltyClass(businessId, b);
    await bizRef(businessId).update({ googleClassId: classId });
  } catch (err) {
    logger.error("No se pudo crear la clase de Google Wallet al activar", { businessId, err });
  }
}

// Primer cobro fallido: empieza la gracia. Si ya estaba en mora, no se reinicia el plazo.
export async function markPastDue(businessId: string, preapprovalId: string): Promise<void> {
  const res = await change(businessId, (s) => {
    if (preapprovalId !== s.mpPreapprovalId) return null;
    if (s.status !== "active") return null; // past_due, bloqueada o archivada: nada que hacer
    return {
      ...s,
      status: "past_due",
      failedPreapprovalId: preapprovalId,
      graceUntil: Timestamp.fromMillis(Date.now() + GRACE_DAYS * DAY_MS),
      notices: {},
    };
  });
  if (res) {
    logger.warn("Cobro fallido: empieza la gracia", { businessId });
    await notify(businessId, res, "pastDue");
    await notifyAdmin(`Cobro fallido: ${res.b.name}`, [`No se pudo cobrar a ${res.b.name}. Empezó el período de gracia.`, `ID: ${businessId}`]);
  }
}

// La suscripción vigente se canceló en Mercado Pago (la dio de baja el dueño o MP tras varios reintentos).
export async function markCancelled(businessId: string, p: Preapproval): Promise<void> {
  const res = await change(businessId, (s) => {
    if (p.id === s.pendingPreapprovalId) {
      // Un checkout que no se completó: se descarta.
      const { pendingPreapprovalId: _a, pendingPlan: _b, pendingAmount: _c, ...rest } = s;
      return rest;
    }
    if (p.id !== s.mpPreapprovalId) return null;
    if (s.status === "past_due") return { ...s, mpStatus: p.status }; // la gracia sigue su curso
    if (s.status !== "active") return null;
    // Lo ya pagado se respeta: queda activa hasta el fin del período y la tarea diaria la bloquea.
    const end = s.currentPeriodEnd?.toMillis() ?? 0;
    if (end > Date.now()) return { ...s, mpStatus: p.status, cancelAtPeriodEnd: true };
    return blockedSub(s);
  });
  if (res?.sub.status === "canceled") await notify(businessId, res, "blocked");
  if (res && p.id === res.b.subscription?.mpPreapprovalId) {
    await notifyAdmin(`Canceló: ${res.b.name}`, [
      `${res.b.name} dio de baja la suscripción en Mercado Pago.`,
      res.sub.cancelAtPeriodEnd ? "Sigue activa hasta el fin del período pagado." : "Quedó en pausa.",
      `ID: ${businessId}`,
    ]);
  }
}

const blockedSub = (s: Subscription): Subscription => ({
  ...s,
  status: "canceled",
  blockedAt: Timestamp.now(),
  notices: { ...s.notices },
});

// Gracia vencida, prueba terminada o fin del período pagado tras cancelar (tarea diaria).
export async function markBlocked(businessId: string, expectedStatus: Subscription["status"]): Promise<void> {
  const res = await change(businessId, (s) => (s.status === expectedStatus ? blockedSub(s) : null));
  if (res) {
    logger.warn("Negocio bloqueado por falta de pago", { businessId, from: expectedStatus });
    await notify(businessId, res, "blocked");
    await notifyAdmin(`Se pausó: ${res.b.name}`, [`${res.b.name} quedó en pausa (venció ${expectedStatus === "past_due" ? "la gracia" : expectedStatus === "trial" ? "la prueba" : "el período pagado"}).`, `ID: ${businessId}`]);
  }
}

export async function markArchived(businessId: string): Promise<void> {
  const res = await change(businessId, (s) =>
    s.status === "canceled" ? { ...s, status: "archived", archivedAt: Timestamp.now() } : null,
  );
  if (res) {
    logger.info("Negocio archivado", { businessId });
    await notify(businessId, res, "archived");
  }
}

// Manda el mail una sola vez por ciclo (queda registrado en subscription.notices).
export async function notify(
  businessId: string,
  { b, sub }: { b: BusinessDoc; sub: Subscription },
  template: keyof NonNullable<Subscription["notices"]>,
  vars: { days?: number; date?: Date } = {},
): Promise<void> {
  if (sub.notices?.[template]) return;
  const date = vars.date ?? (template === "pastDue" ? sub.graceUntil?.toDate() : undefined);
  try {
    await sendMail(b.ownerUid, template, { businessName: b.name, ...vars, date });
    await bizRef(businessId).update({ [`subscription.notices.${template}`]: FieldValue.serverTimestamp() });
  } catch (err) {
    logger.error("No se pudo encolar el mail", { businessId, template, err });
  }
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

async function ownerEmailOf(uid: string): Promise<string | null> {
  try {
    return (await getAuth().getUser(uid)).email ?? null;
  } catch {
    return null;
  }
}
