import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import QRCode from "qrcode";
import { APP_NAME, enrollUrl, SITE_URL } from "../config";
import { HOUR, rateLimit } from "../security/rateLimit";
import { enrollMissing, type BusinessDoc } from "../types";
import { itemNames } from "../wallet/proximity";
import { autoTextColor, dataUri } from "./stamps";

// Afiche para imprimir con el QR de alta: colores, foto y logo del negocio.
// A4 a 150 ppp (1240×1754): se imprime bien en A4 o reducido a A5.
const W = 1240;
const H = 1754;
const FONTS = [join(__dirname, "../../assets/Fredoka-SemiBold.ttf"), join(__dirname, "../../assets/DMSans-Medium.ttf")];
const DEFAULT_BG = "#FF9EC4";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Tamaño de letra para que una línea entre en `maxWidth` (aprox. 0.56 em por carácter en estas fuentes).
const fitSize = (text: string, max: number, maxWidth = W - 160) => Math.min(max, Math.floor(maxWidth / (text.length * 0.56)));

// Parte una frase larga en dos líneas por el espacio más cercano al medio.
function splitLine(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const mid = Math.floor(text.length / 2);
  let cut = text.lastIndexOf(" ", mid);
  const after = text.indexOf(" ", mid);
  if (cut < 0 || (after > 0 && after - mid < mid - cut)) cut = after;
  return cut > 0 ? [text.slice(0, cut), text.slice(cut + 1)] : [text];
}

function qrPath(text: string, x: number, y: number, size: number): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) d += `M${(x + c * cell).toFixed(2)} ${(y + r * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
    }
  }
  return `<path d="${d}" fill="#12372A" shape-rendering="crispEdges"/>`;
}

export async function renderPoster(b: BusinessDoc): Promise<Buffer> {
  const bg = b.design?.bgColor ?? DEFAULT_BG;
  const fg = autoTextColor(bg);
  const total = b.rule!.stampsRequired;
  const { plural } = itemNames(b);
  const [banner, logo] = await Promise.all([
    b.design?.bannerUrl ? dataUri(b.design.bannerUrl) : Promise.resolve(null),
    b.design?.logoUrl ? dataUri(b.design.logoUrl) : Promise.resolve(null),
  ]);

  const parts: string[] = [`<rect width="${W}" height="${H}" fill="${bg}"/>`];

  // Foto arriba, fundida con el color de fondo. Sin foto, el contenido sube.
  const bandH = banner ? 560 : 300;
  if (banner) {
    parts.push(
      `<defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0.55" stop-color="${bg}" stop-opacity="0"/><stop offset="1" stop-color="${bg}" stop-opacity="1"/></linearGradient></defs>`,
      `<image href="${banner}" width="${W}" height="${bandH}" preserveAspectRatio="xMidYMid slice"/>`,
      `<rect width="${W}" height="${bandH}" fill="url(#fade)"/>`,
    );
  }

  // Logo en un círculo blanco con borde de la marca.
  const cx = W / 2;
  const cy = bandH;
  parts.push(`<circle cx="${cx}" cy="${cy}" r="140" fill="#FFFFFF" stroke="${fg}" stroke-width="6"/>`);
  if (!logo) {
    parts.push(`<text x="${cx}" y="${cy + 50}" text-anchor="middle" fill="#12372A" font-family="Fredoka" font-weight="600" font-size="150">${esc(b.name.charAt(0).toUpperCase())}</text>`);
  } else {
    parts.push(
      `<clipPath id="logo"><circle cx="${cx}" cy="${cy}" r="124"/></clipPath>`,
      `<image href="${logo}" x="${cx - 124}" y="${cy - 124}" width="248" height="248" preserveAspectRatio="xMidYMid meet" clip-path="url(#logo)"/>`,
    );
  }

  const text = (y: number, size: number, value: string, opts: { family?: string; opacity?: number } = {}) =>
    `<text x="${cx}" y="${y}" text-anchor="middle" fill="${fg}" fill-opacity="${opts.opacity ?? 1}" ` +
    `font-family="${opts.family ?? "Fredoka"}" font-weight="${opts.family === "DM Sans" ? 500 : 600}" font-size="${size}">${esc(value)}</text>`;

  // Todo se ubica de arriba hacia abajo según lo que haya (foto, premio en una o dos líneas).
  let y = bandH + 250;
  parts.push(text(y, fitSize(b.name, 88), b.name));
  y += 80;
  parts.push(text(y, 50, "Sumate a nuestra tarjeta de fidelidad", { family: "DM Sans" }));

  const reward = `Juntá ${total} ${plural} y llevate ${b.rule!.rewardText}`;
  const lines = splitLine(reward, 38);
  const rewardSize = Math.min(...lines.map((l) => fitSize(l, 46)));
  y += 70;
  lines.forEach((l, i) => parts.push(text(y + i * (rewardSize + 12), rewardSize, l)));
  y += (lines.length - 1) * (rewardSize + 12);

  // Tarjeta blanca con el QR: lo más grande posible sin pisar los textos de abajo.
  const qrTop = y + 50;
  const card = Math.min(560, H - 210 - qrTop);
  const qr = card * 0.84;
  parts.push(
    `<rect x="${cx - card / 2}" y="${qrTop}" width="${card}" height="${card}" rx="44" fill="#FFFFFF" stroke="#12372A" stroke-width="6"/>`,
    qrPath(enrollUrl(b.enrollCode!), cx - qr / 2, qrTop + (card - qr) / 2, qr),
  );

  const after = qrTop + card;
  parts.push(text(after + 68, 36, "Escaneá el código con la cámara del celular", { family: "DM Sans" }));
  parts.push(text(after + 116, 32, "No hace falta descargar ninguna app", { family: "DM Sans", opacity: 0.85 }));
  parts.push(text(H - 30, 24, `hecho con ${APP_NAME.value()} · ${SITE_URL.value().replace(/^https?:\/\//, "")}`, { family: "DM Sans", opacity: 0.7 }));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join("")}</svg>`;
  return new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "DM Sans" } }).render().asPng();
}

// Panel → QR → "Descargar afiche". Devuelve el PNG en base64 (así el navegador lo baja con nombre).
export const enrollPoster = onCall({ enforceAppCheck: true, memory: "512MiB" }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  const businessId = req.data?.businessId;
  if (typeof businessId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(businessId)) {
    throw new HttpsError("invalid-argument", "Negocio inválido.");
  }
  const snap = await getFirestore().doc(`businesses/${businessId}`).get();
  const b = snap.data() as BusinessDoc | undefined;
  if (!b || b.ownerUid !== uid) throw new HttpsError("permission-denied", "Este negocio no es tuyo.");
  if (enrollMissing(b).length > 0 || !b.enrollCode) throw new HttpsError("failed-precondition", "not-ready");
  await rateLimit(`poster:${uid}`, 30, HOUR);
  return { png: (await renderPoster(b)).toString("base64") };
});
