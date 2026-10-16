import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineBoolean } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import type { BusinessDoc } from "../types";
import { notify } from "./state";

// Recordatorio por mail al negocio que lleva DRAFT_REMINDER_HOURS en borrador sin activar.
// Se manda una sola vez (subscription.notices.draftReminder). Para apagarlo:
// DRAFT_REMINDER_ENABLED=false en functions/.env y volver a desplegar.
const DRAFT_REMINDER_ENABLED = defineBoolean("DRAFT_REMINDER_ENABLED", { default: true });
export const DRAFT_REMINDER_HOURS = 48;

// Cada hora de 9 a 21 (hora argentina): nadie recibe el mail de madrugada.
export const draftReminder = onSchedule(
  { schedule: "0 9-21 * * *", timeZone: "America/Argentina/Buenos_Aires", timeoutSeconds: 300 },
  async () => {
    if (!DRAFT_REMINDER_ENABLED.value()) return;
    const cutoff = Timestamp.fromMillis(Date.now() - DRAFT_REMINDER_HOURS * 3600000);
    const snap = await getFirestore()
      .collection("businesses")
      .where("subscription.status", "==", "draft")
      .where("subscription.draftAt", "<=", cutoff)
      .get();
    let sent = 0;
    for (const doc of snap.docs) {
      const b = doc.data() as BusinessDoc;
      const sub = b.subscription!;
      if (b.demo || sub.notices?.draftReminder) continue;
      await notify(doc.id, { b, sub }, "draftReminder");
      sent++;
    }
    logger.info("Recordatorio de borradores", { pending: snap.size, sent });
  },
);
