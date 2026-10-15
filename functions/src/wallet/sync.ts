import { logger } from "firebase-functions";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { resyncBusinessCards } from "../cards/sync";
import { accessLevel, canOperate } from "../payments/access";
import { enrollMissing, type BusinessDoc } from "../types";
import { upsertLoyaltyClass, walletKey } from "./google";

// Cuando el dueño edita el diseño o la regla, se actualiza todo lo emitido en Google Wallet:
// la clase (nombre, logo, color) y cada tarjeta (imagen de sellos, contador y premio).
// Con la suscripción vencida no se toca el Wallet; al reactivar se sincroniza todo una vez.
export const syncGoogleClass = onDocumentUpdated(
  { document: "businesses/{businessId}", secrets: [walletKey], memory: "512MiB", timeoutSeconds: 300 },
  async (event) => {
    const businessId = event.params.businessId;
    const before = event.data?.before.data() as BusinessDoc | undefined;
    const after = event.data?.after.data() as BusinessDoc | undefined;
    if (!before || !after?.googleClassId || enrollMissing(after).length > 0) return;

    const operable = (b: BusinessDoc) => {
      const level = accessLevel(b.subscription);
      return level === "none" || canOperate(level);
    };
    if (!operable(after)) return;
    if (!operable(before)) {
      await upsertLoyaltyClass(businessId, after).catch((err) =>
        logger.error("No se pudo actualizar la clase de Google Wallet", { businessId, err }),
      );
      const result = await resyncBusinessCards(businessId, after);
      logger.info("Tarjetas sincronizadas al reactivar la suscripción", { businessId, ...result });
      return;
    }

    const classFields = (b: BusinessDoc) =>
      JSON.stringify([b.name, b.design?.logoUrl, b.design?.bgColor, b.proximityEnabled ?? false, b.locations ?? []]);
    const cardFields = (b: BusinessDoc) =>
      JSON.stringify([
        b.design?.bgColor,
        b.design?.bannerUrl,
        b.design?.stampIconId,
        b.design?.stampIconUrl,
        b.rule?.stampsRequired,
        b.rule?.rewardText,
        b.rule?.itemSingular,
        b.rule?.itemPlural,
      ]);

    if (classFields(before) !== classFields(after)) {
      try {
        await upsertLoyaltyClass(businessId, after);
      } catch (err) {
        logger.error("No se pudo actualizar la clase de Google Wallet", { businessId, err });
      }
    }
    if (cardFields(before) !== cardFields(after)) {
      const result = await resyncBusinessCards(businessId, after);
      logger.info("Tarjetas sincronizadas tras cambio de diseño", { businessId, ...result });
    }
  },
);
