import { HttpsError, onRequest } from "firebase-functions/v2/https";

// Precio del plan: se cambia acá (y se despliega). Es la única fuente: el checkout de Mercado Pago lo usa
// y la landing y el panel lo leen de GET API_URL/plan. El precio se copia a la suscripción al
// suscribirse, así que cambiarlo solo afecta a las nuevas.
export const PLAN_PRICE_ARS = 25000;

export type Plan = {
  name: string;
  amount: number;
  currency: string;
  frequency: number;
  frequencyType: "days" | "months";
  active: boolean;
};

export const DEFAULT_PLAN = "monthly";

// Para sumar un plan anual más adelante: agregarlo acá con frequency: 12.
const PLANS: Record<string, Plan> = {
  monthly: { name: "Mensual", amount: PLAN_PRICE_ARS, currency: "ARS", frequency: 1, frequencyType: "months", active: true },
};

export function loadPlan(planId: string): Plan {
  const plan = PLANS[planId];
  if (!plan || !plan.active || !(plan.amount > 0)) {
    throw new HttpsError("failed-precondition", "plan");
  }
  return plan;
}

// GET API_URL/plan: el plan mensual para la landing y el panel. Público y cacheado en el CDN.
export const plan = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  const p = PLANS[DEFAULT_PLAN];
  res.set("Cache-Control", "public, max-age=300, s-maxage=600");
  if (!p?.active) {
    res.status(404).json({ error: "not-found" });
    return;
  }
  res.json({ name: p.name, amount: p.amount, currency: p.currency, frequency: p.frequency, frequencyType: p.frequencyType, active: true });
});
