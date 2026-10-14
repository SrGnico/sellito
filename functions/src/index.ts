import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";

initializeApp();

// São Paulo: la región más cercana a Argentina. El frontend usa la misma (web/src/lib/firebase.ts).
setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

// Chequeo de vida para probar el deploy. Las funciones reales van en
// cards/ (alta, sellos, canje), wallet/ (google, apple), images/ y payments/.
export const health = onRequest((_req, res) => {
  res.json({ ok: true, service: "sellito-functions" });
});
