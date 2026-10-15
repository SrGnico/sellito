import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";

initializeApp();

// São Paulo: la región más cercana a Argentina. El frontend usa la misma (web/src/lib/firebase.ts).
setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

export { createCard, ensureEnrollCode, getEnrollInfo } from "./cards/enroll";
export { resyncCards, testSetStamps } from "./cards/sync";
export { syncGoogleClass } from "./wallet/sync";

// Chequeo de vida para probar el deploy.
export const health = onRequest((_req, res) => {
  res.json({ ok: true, service: "sellito-functions" });
});
