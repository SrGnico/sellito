import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";

// Analítica propia y mínima: sin cookies, sin IP guardada, sin datos personales. Solo totales por día
// en analytics/{AAAA-MM-DD}: { events: { landing_view: 12, ... }, sources: { "instagram.com": 3 } }.
// La web llama POST API_URL/track con { e: evento, s?: origen } (navigator.sendBeacon).
// El embudo se ve en /admin.

export const EVENTS = [
  "landing_view", // abrió la landing
  "demo_view", // abrió la tarjeta de prueba
  "demo_add", // tocó "Agregar" en la tarjeta de prueba
  "cta_click", // tocó "Crear mi tarjeta"
  "signup", // creó la cuenta
  "business_created", // creó el negocio
  "wizard_done", // terminó el asistente
  "subscribe_click", // tocó "Suscribirme"
  "enroll_view", // un cliente abrió la página de alta de un negocio real
  "enroll_add", // un cliente agregó la tarjeta de un negocio real
] as const;

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

// Origen: dominio del referrer o utm_source, solo letras, números, puntos y guiones.
const cleanSource = (s: unknown) =>
  typeof s === "string" ? s.toLowerCase().replace(/^www\./, "").replace(/[^a-z0-9.-]/g, "").slice(0, 40) : "";

export const track = onRequest({ cors: true, memory: "128MiB", maxInstances: 5 }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  let body = req.body as { e?: unknown; s?: unknown } | string;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { e, s } = body as { e?: unknown; s?: unknown };
  if (typeof e !== "string" || !(EVENTS as readonly string[]).includes(e)) {
    res.status(400).end();
    return;
  }
  const update: Record<string, Record<string, FieldValue>> = { events: { [e]: FieldValue.increment(1) } };
  const source = cleanSource(s);
  // El origen se cuenta solo con la visita a la landing (no en cada evento).
  if (e === "landing_view" && source) update.sources = { [source]: FieldValue.increment(1) };
  await getFirestore().doc(`analytics/${today()}`).set(update, { merge: true });
  res.status(204).end();
});
