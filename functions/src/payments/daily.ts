import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import type { BusinessDoc } from "../types";
import { ARCHIVE_AFTER_DAYS, ARCHIVE_WARNING_DAYS, DAY_MS, GRACE_WARNING_DAYS } from "./access";
import { markArchived, markBlocked, notify } from "./state";

// Revisión diaria de suscripciones. Es el respaldo del webhook: si se pierde un aviso de
// Mercado Pago, acá igual se bloquea al vencer la gracia, la prueba o el período pagado.
export const dailySubscriptionCheck = onSchedule(
  { schedule: "every day 09:00", timeZone: "America/Argentina/Buenos_Aires", timeoutSeconds: 540 },
  async () => {
    const now = Date.now();
    const byStatus = (status: string) =>
      getFirestore().collection("businesses").where("subscription.status", "==", status).get();
    const [pastDue, trial, active, canceled] = await Promise.all(
      ["past_due", "trial", "active", "canceled"].map(byStatus),
    );
    const counts = { blocked: 0, warned: 0, archived: 0 };

    for (const doc of pastDue.docs) {
      await safe(doc.id, async () => {
        const b = doc.data() as BusinessDoc;
        const sub = b.subscription!;
        const until = sub.graceUntil?.toMillis() ?? 0;
        if (until <= now) {
          await markBlocked(doc.id, "past_due");
          counts.blocked++;
          return;
        }
        await notify(doc.id, { b, sub }, "pastDue"); // por si el webhook no llegó a mandarlo
        const daysLeft = Math.ceil((until - now) / DAY_MS);
        if (daysLeft <= GRACE_WARNING_DAYS) {
          await notify(doc.id, { b, sub }, "graceEnding", { days: daysLeft, date: sub.graceUntil!.toDate() });
          counts.warned++;
        }
      });
    }

    for (const doc of trial.docs) {
      const sub = (doc.data() as BusinessDoc).subscription!;
      if ((sub.trialEndsAt?.toMillis() ?? 0) > now) continue;
      await safe(doc.id, () => markBlocked(doc.id, "trial")); // sin gracia
      counts.blocked++;
    }

    for (const doc of active.docs) {
      const sub = (doc.data() as BusinessDoc).subscription!;
      if (!sub.cancelAtPeriodEnd || (sub.currentPeriodEnd?.toMillis() ?? 0) > now) continue;
      await safe(doc.id, () => markBlocked(doc.id, "active"));
      counts.blocked++;
    }

    for (const doc of canceled.docs) {
      await safe(doc.id, async () => {
        const b = doc.data() as BusinessDoc;
        const sub = b.subscription!;
        const archiveAt = (sub.blockedAt?.toMillis() ?? now) + ARCHIVE_AFTER_DAYS * DAY_MS;
        if (archiveAt <= now) {
          await markArchived(doc.id);
          counts.archived++;
        } else if (archiveAt - now <= ARCHIVE_WARNING_DAYS * DAY_MS) {
          const days = Math.ceil((archiveAt - now) / DAY_MS);
          await notify(doc.id, { b, sub }, "archiveWarning", { days, date: new Date(archiveAt) });
        }
      });
    }

    logger.info("Revisión diaria de suscripciones", counts);
  },
);

async function safe(businessId: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    logger.error("Revisión diaria: falló un negocio", { businessId, err });
  }
}
