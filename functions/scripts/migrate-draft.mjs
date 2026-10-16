// Migración única al flujo "borrador → activa" (sin prueba gratis).
//
//   cd functions
//   gcloud auth application-default login            # una vez, con una cuenta con acceso al proyecto
//   GOOGLE_CLOUD_PROJECT=<proyecto> node scripts/migrate-draft.mjs           # muestra qué cambiaría
//   GOOGLE_CLOUD_PROJECT=<proyecto> node scripts/migrate-draft.mjs --apply   # lo guarda
//
// - Sin suscripción o en prueba → borrador. draftAt = fecha de alta. Se marca el recordatorio como
//   enviado para que no les llegue el mail de las 48 h apenas se despliega.
// - Activas, en mora, canceladas o archivadas sin activatedAt → activatedAt aproximada (último cambio
//   de la suscripción o fecha de alta).
// - La tarjeta de ejemplo de la landing (demo) no se toca. Código de QR y clase de Wallet ya creados quedan como están.
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const apply = process.argv.includes("--apply");
initializeApp();
const db = getFirestore();
const now = Timestamp.now();

const snap = await db.collection("businesses").get();
let drafts = 0;
let activated = 0;
const batch = db.batch();

for (const doc of snap.docs) {
  const b = doc.data();
  if (b.demo) continue;
  const sub = b.subscription ?? {};
  const createdAt = b.createdAt ?? now;
  if (!sub.status || sub.status === "trial") {
    drafts++;
    console.log(`borrador   ${doc.id}  ${b.name}  (antes: ${sub.status ?? "sin suscripción"})`);
    batch.update(doc.ref, {
      "subscription.status": "draft",
      "subscription.draftAt": sub.draftAt ?? createdAt,
      "subscription.notices.draftReminder": now,
      "subscription.updatedAt": now,
    });
  } else if (sub.status !== "draft" && !sub.activatedAt) {
    activated++;
    console.log(`activatedAt ${doc.id}  ${b.name}  (${sub.status})`);
    batch.update(doc.ref, { "subscription.activatedAt": sub.updatedAt ?? createdAt });
  }
}

console.log(`\n${drafts} pasan a borrador, ${activated} reciben activatedAt.`);
if (apply && drafts + activated > 0) {
  await batch.commit(); // hasta 500 negocios por lote: alcanza para los de prueba
  console.log("Guardado.");
} else if (!apply) {
  console.log("Modo prueba: no se guardó nada. Volvé a correrlo con --apply.");
}
