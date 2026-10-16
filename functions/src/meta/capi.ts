import { createHash } from "node:crypto";
import { logger } from "firebase-functions";
import { defineSecret, defineString } from "firebase-functions/params";
import { APP_URL } from "../config";
import type { BusinessDoc } from "../types";

// API de Conversiones de Meta: el evento "Subscribe" sale del servidor cuando Mercado Pago confirma el
// pago (más confiable que el navegador, que puede no volver al panel). Lleva el mismo event_id que el
// Pixel (subscribe_<id de la suscripción>), así Meta lo cuenta una sola vez.
// Solo se mandan datos del dueño de la cuenta, hasheados: nunca teléfonos ni datos de los clientes
// finales de los negocios.
//   META_PIXEL_ID → functions/.env (vacío = no se manda nada)
//   META_CAPI_TOKEN → Secret Manager (token de acceso del Administrador de eventos)
//   META_TEST_EVENT_CODE → functions/.env, solo mientras se prueba en el Probador de eventos

export const metaCapiToken = defineSecret("META_CAPI_TOKEN");
const META_PIXEL_ID = defineString("META_PIXEL_ID", { default: "" });
const META_TEST_EVENT_CODE = defineString("META_TEST_EVENT_CODE", { default: "" });
const GRAPH_VERSION = "v21.0";

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export async function sendSubscribeEvent(
  businessId: string,
  b: BusinessDoc,
  preapprovalId: string,
  ownerEmail: string | null,
  amount: number | undefined,
  currency: string | undefined,
): Promise<void> {
  let pixelId = "";
  let token = "";
  try {
    pixelId = META_PIXEL_ID.value();
    token = metaCapiToken.value();
  } catch {
    return; // esta función no tiene el secreto: no se mide, el cobro sigue
  }
  if (!pixelId || !token || token === "pendiente") return;
  const a = b.attribution ?? {};
  const event = {
    event_name: "Subscribe",
    event_time: Math.floor(Date.now() / 1000),
    event_id: `subscribe_${preapprovalId}`,
    action_source: "website",
    event_source_url: `${APP_URL.value()}/panel`,
    user_data: {
      ...(ownerEmail ? { em: [sha256(ownerEmail)] } : {}),
      external_id: [sha256(businessId)],
      ...(a.fbc ? { fbc: a.fbc } : {}),
      ...(a.fbp ? { fbp: a.fbp } : {}),
      ...(a.ua ? { client_user_agent: a.ua } : {}),
    },
    custom_data: { ...(amount ? { value: amount, currency: currency ?? "ARS" } : {}), content_name: "suscripcion" },
  };
  const test = META_TEST_EVENT_CODE.value();
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event], ...(test ? { test_event_code: test } : {}) }),
    });
    const body = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
    if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    logger.info("Meta: evento Subscribe enviado", { businessId, eventId: event.event_id, received: body.events_received });
  } catch (err) {
    // Nunca frena el cobro: si Meta falla, solo se pierde la medición.
    logger.error("Meta: no se pudo enviar Subscribe", { businessId, error: err instanceof Error ? err.message : String(err) });
  }
}
