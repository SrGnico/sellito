import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { StampImages } from "../images/stamps";
import type { BusinessDoc, CardDoc } from "../types";
import { APPLE_PASS_TYPE_ID, appleSecrets, buildPkpass, parseSerial } from "./apple";

// PassKit web service (API_URL/applePass; rewrite "/applePass/**" en el sitio sellito-api).
// Apple llama a {webServiceURL}/v1/...  https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes
// Además: GET /download/{serial}/{token} para bajar la tarjeta desde la página de alta.

const db = () => getFirestore();

type Loaded = { businessId: string; cardId: string; b: BusinessDoc; card: CardDoc };

async function loadPass(serial: string, token: string | undefined): Promise<Loaded | null> {
  const ids = parseSerial(serial);
  if (!ids || !token) return null;
  const [cardSnap, bizSnap] = await Promise.all([
    db().doc(`businesses/${ids.businessId}/cards/${ids.cardId}`).get(),
    db().doc(`businesses/${ids.businessId}`).get(),
  ]);
  const card = cardSnap.data() as CardDoc | undefined;
  const b = bizSnap.data() as BusinessDoc | undefined;
  if (!card || !b?.rule || card.platform !== "apple" || card.appleAuthToken !== token) return null;
  return { ...ids, b, card };
}

const authToken = (req: Request) => /^ApplePass (.+)$/.exec(req.get("authorization") ?? "")?.[1];

async function sendPass(res: Response, p: Loaded, attachment: boolean) {
  const buf = await buildPkpass(p.businessId, p.cardId, p.b, p.card, new StampImages(p.businessId, p.b));
  res.set("Content-Type", "application/vnd.apple.pkpass");
  res.set("Cache-Control", "no-store");
  res.set("Last-Modified", new Date(p.card.appleUpdatedAt ?? Date.now()).toUTCString());
  if (attachment) res.set("Content-Disposition", `attachment; filename="tarjeta.pkpass"`);
  res.status(200).send(buf);
}

export const applePass = onRequest({ secrets: appleSecrets, memory: "512MiB" }, async (req, res) => {
  const parts = req.path.replace(/^\/applePass/, "").split("/").filter(Boolean);
  try {
    // Descarga desde la página de alta: /download/{serial}/{token}
    if (req.method === "GET" && parts[0] === "download" && parts.length === 3) {
      const p = await loadPass(parts[1], parts[2]);
      if (!p) return void res.status(404).send("not found");
      return void (await sendPass(res, p, true));
    }

    if (parts[0] !== "v1") return void res.status(404).send("not found");

    // Log de errores del iPhone.
    if (req.method === "POST" && parts[1] === "log") {
      logger.warn("Apple Wallet log", { logs: req.body?.logs });
      return void res.status(200).send();
    }

    // Pase actualizado: /v1/passes/{passTypeId}/{serial}
    if (req.method === "GET" && parts[1] === "passes" && parts.length === 4) {
      if (parts[2] !== APPLE_PASS_TYPE_ID.value()) return void res.status(404).send();
      const p = await loadPass(parts[3], authToken(req));
      if (!p) return void res.status(401).send();
      const since = Date.parse(req.get("if-modified-since") ?? "");
      if (since && p.card.appleUpdatedAt && Math.floor(p.card.appleUpdatedAt / 1000) * 1000 <= since) {
        return void res.status(304).send();
      }
      return void (await sendPass(res, p, false));
    }

    // Registro de un dispositivo: /v1/devices/{deviceId}/registrations/{passTypeId}[/{serial}]
    if (parts[1] === "devices" && parts[3] === "registrations" && parts[4] === APPLE_PASS_TYPE_ID.value()) {
      const deviceId = parts[2];
      if (!/^[A-Za-z0-9._-]{1,128}$/.test(deviceId)) return void res.status(400).send();

      // Lista de pases cambiados desde `passesUpdatedSince`.
      if (req.method === "GET" && parts.length === 5) {
        const since = Number(req.query.passesUpdatedSince ?? 0) || 0;
        const regs = await db().collection("appleRegistrations").where("deviceId", "==", deviceId).get();
        let last = since;
        const serials: string[] = [];
        for (const r of regs.docs) {
          const ids = parseSerial(r.get("serial"));
          if (!ids) continue;
          const card = (await db().doc(`businesses/${ids.businessId}/cards/${ids.cardId}`).get()).data() as CardDoc | undefined;
          const updated = card?.appleUpdatedAt ?? 0;
          if (updated > since) {
            serials.push(r.get("serial"));
            last = Math.max(last, updated);
          }
        }
        if (serials.length === 0) return void res.status(204).send();
        return void res.status(200).json({ serialNumbers: serials, lastUpdated: String(last) });
      }

      if (parts.length !== 6) return void res.status(404).send();
      const serial = parts[5];
      const p = await loadPass(serial, authToken(req));
      if (!p) return void res.status(401).send();
      const ref = db().doc(`appleRegistrations/${deviceId}__${serial}`);

      if (req.method === "POST") {
        const pushToken = String(req.body?.pushToken ?? "");
        if (!/^[A-Fa-f0-9]{32,200}$/.test(pushToken)) return void res.status(400).send();
        const existed = (await ref.get()).exists;
        await ref.set({ deviceId, pushToken, serial, businessId: p.businessId, cardId: p.cardId, updatedAt: FieldValue.serverTimestamp() });
        return void res.status(existed ? 200 : 201).send();
      }
      if (req.method === "DELETE") {
        await ref.delete();
        return void res.status(200).send();
      }
    }

    res.status(404).send("not found");
  } catch (err) {
    logger.error("applePass falló", { path: req.path, method: req.method, error: err instanceof Error ? err.message : String(err) });
    res.status(500).send();
  }
});
