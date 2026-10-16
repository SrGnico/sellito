import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { accessLevel, canOperate } from "../payments/access";
import { sendCardMessage } from "../notices";
import type { BusinessDoc, CardDoc } from "../types";
import { appleSecrets } from "../wallet/apple";
import { walletKey } from "../wallet/google";
import { birthdayMessage, isLeap, todayAR, TZ } from "./rules";

// Saludo de cumpleaños (la lógica está en ./rules.ts, sin dependencias para poder usarla en todos lados).
const db = () => getFirestore();

// Todos los días a la mañana: saluda a quienes cumplen hoy (o, si el regalo es por todo el mes, el día 1
// a quienes cumplen ese mes). Solo a quien aceptó recibir novedades, y una vez por año.
export const birthdayGreetings = onSchedule(
  { schedule: "every day 10:00", timeZone: TZ, timeoutSeconds: 540, memory: "512MiB", secrets: [walletKey, ...appleSecrets] },
  async () => {
    const t = todayAR();
    const businesses = await db().collection("businesses").where("birthday.enabled", "==", true).get();
    const counts = { businesses: 0, sent: 0, skipped: 0, failed: 0 };

    for (const bizDoc of businesses.docs) {
      const b = bizDoc.data() as BusinessDoc;
      if (!b.birthday?.notify || !canOperate(accessLevel(b.subscription))) continue;
      const cards = db().collection(`businesses/${bizDoc.id}/cards`);
      let snap;
      if (b.birthday.when === "month") {
        if (t.d !== "01") continue;
        snap = await cards.where("birthdayM", "==", t.m).get();
      } else {
        const days = [t.md];
        if (t.md === "02-28" && !isLeap(t.year)) days.push("02-29");
        snap = await cards.where("birthdayMD", "in", days).get();
      }
      counts.businesses++;

      for (const doc of snap.docs) {
        const card = doc.data() as CardDoc;
        if (card.consent?.marketing !== true || card.birthdayNotifiedYear === t.year) {
          counts.skipped++;
          continue;
        }
        try {
          const { title, body } = birthdayMessage(b, card);
          await sendCardMessage(bizDoc.id, doc.id, card, title, body);
          await doc.ref.update({ birthdayNotifiedYear: t.year });
          counts.sent++;
        } catch (err) {
          counts.failed++;
          logger.warn("No se pudo mandar el saludo de cumpleaños", { businessId: bizDoc.id, cardId: doc.id, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    logger.info("Saludos de cumpleaños", { day: t.ymd, ...counts });
  },
);
