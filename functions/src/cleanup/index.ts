import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { designOf, fingerprint } from "../images/stamps";
import type { BusinessDoc } from "../types";

// Limpieza semanal de Storage: borra lo que ya no usa nadie.
//   businesses/{id}/public/    logos, fondos e íconos subidos que el diseño ya no usa
//   businesses/{id}/generated/ imágenes de sellos de diseños anteriores
//   businesses/{id}/           todo, si el negocio ya no existe
// Solo archivos con más de GRACE_DAYS: un logo recién subido puede estar en un borrador sin guardar, y una
// tarjeta que todavía no se actualizó puede seguir mostrando la imagen del diseño anterior.
// Los contadores, las sesiones del escáner y los mails viejos se borran solos con políticas TTL de
// Firestore sobre `expiresAt` (ver README de despliegue).
const GRACE_DAYS = 30;
const DAY_MS = 86_400_000;

export const cleanupStorage = onSchedule(
  { schedule: "every sunday 04:00", timeZone: "America/Argentina/Buenos_Aires", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const bucket = getStorage().bucket();
    const cutoff = Date.now() - GRACE_DAYS * DAY_MS;
    const [files] = await bucket.getFiles({ prefix: "businesses/" });

    // Agrupar por negocio y traer solo esos documentos.
    const ids = [...new Set(files.map((f) => f.name.split("/")[1]).filter(Boolean))];
    const docs = ids.length ? await getFirestore().getAll(...ids.map((id) => getFirestore().doc(`businesses/${id}`))) : [];
    const businesses = new Map(docs.map((d) => [d.id, d.exists ? (d.data() as BusinessDoc) : null]));

    const counts = { checked: files.length, deleted: 0, failed: 0 };
    for (const file of files) {
      const [, id, folder, sub] = file.name.split("/");
      const updated = Date.parse(String(file.metadata.updated ?? file.metadata.timeCreated ?? ""));
      if (!updated || updated > cutoff) continue;

      const b = businesses.get(id);
      let unused: boolean;
      if (b === null) unused = true; // negocio borrado
      else if (!b) continue;
      else if (folder === "public") {
        const inUse = [b.design?.logoUrl, b.design?.wideLogoUrl, b.design?.bannerUrl, b.design?.stampIconUrl].filter(Boolean) as string[];
        unused = !inUse.some((url) => url.includes(encodeURIComponent(file.name)) || url.includes(file.name));
      } else if (folder === "generated") unused = sub !== fingerprint(designOf(b));
      else continue; // carpeta desconocida: no se toca

      if (!unused) continue;
      try {
        await file.delete();
        counts.deleted++;
      } catch (err) {
        counts.failed++;
        logger.warn("No se pudo borrar un archivo viejo", { path: file.name, error: err instanceof Error ? err.message : String(err) });
      }
    }
    logger.info("Limpieza de Storage", counts);
  },
);
