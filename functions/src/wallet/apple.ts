import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import http2 from "node:http2";
import { join } from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret, defineString } from "firebase-functions/params";
import { PKPass } from "passkit-generator";
import { cardCodeSuffix } from "../cards/codes";
import { API_URL, APP_NAME, SITE_URL } from "../config";
import { autoTextColor, dataUri, renderPng, type StampImages } from "../images/stamps";
import type { BusinessDoc, CardDoc } from "../types";
import { PROGRAM_NAME } from "./google";
import { appleLocations, proximityText } from "./proximity";

// Apple Wallet: pases .pkpass firmados con el certificado del Pass Type ID y actualizados por el
// "PassKit web service" (API_URL/applePass, ver wallet/appleService.ts) + push por APNs.
// Clave y certificado en Secret Manager; el certificado intermedio de Apple (WWDR G4) va en assets/.
export const applePassKey = defineSecret("APPLE_PASS_KEY");
export const applePassCert = defineSecret("APPLE_PASS_CERT");
export const APPLE_PASS_TYPE_ID = defineString("APPLE_PASS_TYPE_ID");
export const APPLE_TEAM_ID = defineString("APPLE_TEAM_ID");
export const appleSecrets = [applePassKey, applePassCert];

const WWDR = readFileSync(join(__dirname, "../../assets/AppleWWDRCAG4.pem"));
const DEFAULT_BG = "#FF9EC4";

// El número de serie lleva el negocio para encontrar la tarjeta sin índices.
export const appleSerial = (businessId: string, cardId: string) => `${businessId}.${cardId}`;

export function parseSerial(serial: string): { businessId: string; cardId: string } | null {
  const m = /^([A-Za-z0-9]{1,40})\.([A-Za-z0-9]{1,40})$/.exec(serial);
  return m ? { businessId: m[1], cardId: m[2] } : null;
}

export const newAppleAuthToken = () => randomBytes(24).toString("base64url");

// Link de descarga que abre la página de alta en el iPhone (el token es el de esa tarjeta).
export const appleDownloadUrl = (businessId: string, cardId: string, token: string) =>
  `${API_URL.value()}/applePass/download/${appleSerial(businessId, cardId)}/${token}`;

function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

// Logo e ícono: el logo del negocio encajado (sin recortar) en el tamaño que pide Apple.
function fitImage(src: string, w: number, h: number, bg: string | null, align: "xMinYMid" | "xMidYMid"): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    (bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : "") +
    `<image href="${src}" width="${w}" height="${h}" preserveAspectRatio="${align} meet"/></svg>`
  );
}

// Logo en círculo, igual que Google Wallet (que recorta el logo en un círculo). Apple lo muestra tal
// cual: sin esto, un logo con fondo se ve como un cuadrado. 150×150 px = 50 pt de alto en @3x.
function circleLogo(src: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" width="150" height="150">` +
    `<clipPath id="c"><circle cx="75" cy="75" r="75"/></clipPath>` +
    `<image href="${src}" width="150" height="150" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/></svg>`
  );
}

async function logoBuffers(logoUrl: string): Promise<Record<string, Buffer>> {
  const src = await dataUri(logoUrl);
  if (!src) return {};
  const logo = circleLogo(src);
  const icon = fitImage(src, 87, 87, "#FFFFFF", "xMidYMid"); // ícono: 29×29 pt
  return {
    "logo.png": renderPng(logo, 50),
    "logo@2x.png": renderPng(logo, 100),
    "logo@3x.png": renderPng(logo, 150),
    "icon.png": renderPng(icon, 29),
    "icon@2x.png": renderPng(icon, 58),
    "icon@3x.png": renderPng(icon, 87),
  };
}

// `card.appleNotify`: si el último cambio puede avisar (lo decide notifyDecision en el escáner).
// Sin changeMessage, el iPhone actualiza la tarjeta en silencio.
export async function buildPkpass(businessId: string, cardId: string, b: BusinessDoc, card: CardDoc, images: StampImages): Promise<Buffer> {
  const total = b.rule!.stampsRequired;
  const stamps = Math.min(card.stamps, total);
  const bg = b.design?.bgColor ?? DEFAULT_BG;
  const fg = rgb(autoTextColor(bg));
  const code = cardCodeSuffix(card.barcodeValue);
  const locations = appleLocations(b, stamps);

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: APPLE_PASS_TYPE_ID.value(),
    teamIdentifier: APPLE_TEAM_ID.value(),
    serialNumber: appleSerial(businessId, cardId),
    organizationName: b.name,
    description: `${PROGRAM_NAME} de ${b.name}`,
    logoText: b.name,
    backgroundColor: rgb(bg),
    foregroundColor: fg,
    labelColor: fg,
    webServiceURL: `${API_URL.value()}/applePass`,
    authenticationToken: card.appleAuthToken,
    barcodes: [{ format: "PKBarcodeFormatQR", message: card.barcodeValue, messageEncoding: "iso-8859-1", altText: code }],
    ...(locations.length ? { locations } : {}),
    storeCard: {
      headerFields: [{ key: "sellos", label: "Sellos", value: stamps >= total ? "¡Premio listo!" : `${stamps} de ${total}` }],
      // Último aviso del negocio: al cambiar, el iPhone muestra la notificación (changeMessage).
      ...(card.appleNotice
        ? { auxiliaryFields: [{ key: "novedad", label: card.appleNotice.title, value: card.appleNotice.body, changeMessage: "%@" }] }
        : {}),
      secondaryFields: [
        {
          key: "progreso",
          label: "Tu progreso",
          value: proximityText(b, stamps),
          ...(card.appleNotify ? { changeMessage: "%@" } : {}),
        },
      ],
      backFields: [
        { key: "premio", label: "Premio", value: `Al juntar ${total} sellos: ${b.rule!.rewardText}` },
        ...(b.rule!.conditions ? [{ key: "condiciones", label: "Condiciones", value: b.rule!.conditions }] : []),
        { key: "codigo", label: "Código de la tarjeta", value: code },
        { key: "como", label: "Cómo funciona", value: `Mostrá esta tarjeta en ${b.name} cada vez que comprás y te suman un sello.` },
        { key: "app", label: "Tarjeta hecha con", value: `${APP_NAME.value()} · ${SITE_URL.value()}` },
      ],
    },
  };

  const [logos, strip] = await Promise.all([b.design?.logoUrl ? logoBuffers(b.design.logoUrl) : Promise.resolve({}), images.appleStrip(stamps)]);
  const pass = new PKPass(
    { "pass.json": Buffer.from(JSON.stringify(passJson)), ...logos, ...strip },
    { wwdr: WWDR, signerCert: applePassCert.value(), signerKey: applePassKey.value() },
  );
  return pass.getAsBuffer();
}

// ---------- Push (APNs): avisa a los iPhone que bajen la versión nueva ----------

async function apnsPush(tokens: string[]): Promise<string[]> {
  const gone: string[] = [];
  if (tokens.length === 0) return gone;
  const client = http2.connect("https://api.push.apple.com", { cert: applePassCert.value(), key: applePassKey.value() });
  try {
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ":method": "POST",
              ":path": `/3/device/${token}`,
              "apns-topic": APPLE_PASS_TYPE_ID.value(),
              "content-type": "application/json",
            });
            req.on("response", (headers) => {
              const status = Number(headers[":status"]);
              if (status === 410) gone.push(token); // el iPhone ya no tiene la tarjeta
              else if (status !== 200) logger.warn("APNs rechazó el push", { status });
            });
            req.on("error", (err) => logger.warn("APNs error", { err: String(err) }));
            req.on("close", () => resolve());
            req.end("{}");
          }),
      ),
    );
  } finally {
    client.close();
  }
  return gone;
}

// Marca la tarjeta como cambiada y avisa a los iPhone que la tienen.
export async function pushApplePass(businessId: string, cardId: string, notify: boolean): Promise<void> {
  const db = getFirestore();
  await db.doc(`businesses/${businessId}/cards/${cardId}`).update({ appleUpdatedAt: Date.now(), appleNotify: notify });
  const regs = await db.collection("appleRegistrations").where("serial", "==", appleSerial(businessId, cardId)).get();
  const gone = await apnsPush([...new Set(regs.docs.map((d) => d.get("pushToken") as string))]);
  await Promise.all(regs.docs.filter((d) => gone.includes(d.get("pushToken"))).map((d) => d.ref.delete()));
}
