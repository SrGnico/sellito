import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";

// Planes y precios: documento `config/plans` en Firestore (se edita desde la consola).
// El precio se copia a la suscripción al suscribirse, así que cambiarlo solo afecta a las nuevas.
//
// {
//   trialDays: 0,                       // > 0 activa la prueba gratis para los negocios nuevos
//   plans: {
//     monthly: { name: "Mensual", amount: 15000, currency: "ARS", frequency: 1, frequencyType: "months", active: true },
//     annual:  { ..., frequency: 12, active: false }   // más adelante
//   }
// }
export type Plan = {
  name: string;
  amount: number;
  currency: string;
  frequency: number;
  frequencyType: "days" | "months";
  active: boolean;
};

export type PlansConfig = { trialDays?: number; plans?: Record<string, Plan> };

export const DEFAULT_PLAN = "monthly";

export async function loadPlans(): Promise<PlansConfig> {
  const snap = await getFirestore().doc("config/plans").get();
  return (snap.data() as PlansConfig | undefined) ?? {};
}

export async function loadPlan(planId: string): Promise<Plan> {
  const plan = (await loadPlans()).plans?.[planId];
  if (!plan || !plan.active || !(plan.amount > 0)) {
    throw new HttpsError("failed-precondition", "plan");
  }
  return plan;
}

// GET API_URL/plan: el plan mensual para la landing y el panel. Público y cacheado en el CDN
// (más rápido que leer Firestore desde el navegador).
export const plan = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  const p = (await loadPlans()).plans?.[DEFAULT_PLAN];
  res.set("Cache-Control", "public, max-age=300, s-maxage=600");
  if (!p?.active) {
    res.status(404).json({ error: "not-found" });
    return;
  }
  res.json({ name: p.name, amount: p.amount, currency: p.currency, frequency: p.frequency, frequencyType: p.frequencyType, active: true });
});
