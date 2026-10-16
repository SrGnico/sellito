import { logger } from "firebase-functions";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { resyncBusinessCards } from "../cards/sync";
import { accessLevel, canOperate } from "../payments/access";
import { enrollMissing, type BusinessDoc } from "../types";
import { appleSecrets } from "./apple";
import { upsertLoyaltyClass, walletKey } from "./google";

// Cuando el dueño edita el diseño o la regla, se actualiza todo lo emitido en Google Wallet:
// la clase (nombre, logo, color) y cada tarjeta (imagen de sellos, contador y premio).
// En borrador o con la suscripción vencida no se toca el Wallet; al activar se sincroniza todo una vez.
export const syncGoogleClass = onDocumentUpdated(
  { document: "businesses/{businessId}", secrets: [walletKey, ...appleSecrets], memory: "512MiB", timeoutSeconds: 300 },
  async (event) => {
    const businessId = event.params.businessId;
    const before = event.data?.before.data() as BusinessDoc | undefined;
    const after = event.data?.after.data() as BusinessDoc | undefined;
    if (!before || !after || enrollMissing(after).length > 0) return;

    // En borrador no hay nada emitido; al activar se sincroniza (y la clase la crea payments/state.ts).
    const operable = (b: BusinessDoc) => b.demo === true || canOperate(accessLevel(b.subscription));
    if (!operable(after)) return;
    if (!operable(before)) {
      if (after.googleClassId) {
        await upsertLoyaltyClass(businessId, after).catch((err) =>
          logger.error("No se pudo actualizar la clase de Google Wallet", { businessId, err }),
        );
      }
      const result = await resyncBusinessCards(businessId, after);
      logger.info("Tarjetas sincronizadas al reactivar la suscripción", { businessId, ...result });
      return;
    }

    const classFields = (b: BusinessDoc) =>
      JSON.stringify([b.name, b.design?.logoUrl, b.design?.wideLogoUrl, b.design?.bgColor, b.proximityEnabled ?? false, b.locations ?? []]);
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
        b.rule?.conditions,
        JSON.stringify(b.birthday ?? null),
      ]);

    const classChanged = classFields(before) !== classFields(after);
    if (classChanged && after.googleClassId) {
      try {
        await upsertLoyaltyClass(businessId, after);
      } catch (err) {
        logger.error("No se pudo actualizar la clase de Google Wallet", { businessId, err });
      }
    }
    // En Apple no hay "clase": nombre, logo, color y locales van dentro de cada pase.
    if (classChanged || cardFields(before) !== cardFields(after)) {
      const result = await resyncBusinessCards(businessId, after);
      logger.info("Tarjetas sincronizadas tras cambio de diseño", { businessId, ...result });
    }
  },
);
