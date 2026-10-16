import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";

initializeApp();

// São Paulo: la región más cercana a Argentina. El frontend usa la misma (web/src/lib/firebase.ts).
setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

export { createCard, enrollInfo, ensureEnrollCode, getEnrollInfo } from "./cards/enroll";
export { resyncCards } from "./cards/sync";
export { exportCustomers, upgradeCards } from "./customers";
export { dailySubscriptionCheck } from "./payments/daily";
export { createSubscription, mpWebhook, startTrial } from "./payments";
export { scannerLogin, scannerLookup, scannerSession, scannerStamp, setScannerPin } from "./scanner";
export { enrollPoster } from "./images/poster";
export { geocodeAddress } from "./locations/geocode";
export { deliverNotice, sendNotice } from "./notices";
export { applePass } from "./wallet/appleService";
export { syncGoogleClass } from "./wallet/sync";

// Chequeo de vida para probar el deploy.
export const health = onRequest((_req, res) => {
  res.json({ ok: true, service: "sellito-functions" });
});
export { deliverMail, welcomeMail } from "./mail";
export { cleanupStorage } from "./cleanup";
export { track } from "./analytics";
export { birthdayGreetings } from "./birthday";
export { plan } from "./payments/plans";
