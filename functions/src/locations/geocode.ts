import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { APP_NAME, APP_URL } from "../config";
import { HOUR, rateLimit } from "../security/rateLimit";

// Dirección → coordenadas para los locales del negocio (cercanía en el Wallet).
// Usa Nominatim (OpenStreetMap): gratis, pide identificarse y como máximo 1 consulta por segundo.
// Alcanza para que cada dueño cargue sus ≤ 10 locales; si el volumen crece, pasar a un servicio pago.
// https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export const geocodeAddress = onCall({ maxInstances: 2 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  const { businessId, query } = req.data ?? {};
  if (typeof businessId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(businessId)) {
    throw new HttpsError("invalid-argument", "Negocio inválido.");
  }
  const q = typeof query === "string" ? query.trim() : "";
  if (q.length < 4 || q.length > 200) throw new HttpsError("invalid-argument", "query");

  const biz = await getFirestore().doc(`businesses/${businessId}`).get();
  if (!biz.exists || biz.get("ownerUid") !== uid) throw new HttpsError("permission-denied", "Este negocio no es tuyo.");
  await rateLimit(`geocode:${uid}`, 30, HOUR);

  const url = `${NOMINATIM}?${new URLSearchParams({ q, format: "jsonv2", countrycodes: "ar", limit: "5", "accept-language": "es" })}`;
  const res = await fetch(url, { headers: { "User-Agent": `${APP_NAME.value()} (${APP_URL.value()})`, Referer: APP_URL.value() } });
  if (!res.ok) {
    logger.error("Nominatim respondió con error", { status: res.status });
    throw new HttpsError("unavailable", "geocoder");
  }
  const results = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return {
    results: results.map((r) => ({ address: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })),
  };
});
