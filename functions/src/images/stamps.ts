import { createHash } from "node:crypto";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import type { BusinessDoc } from "../types";
import { CHECK_ICON, STAMP_ICONS } from "./stampIcons";

// Imagen de sellos de la tarjeta: heroImage de Google Wallet (1032×336) y strip de Apple Wallet
// (1125×432 en @3x). MISMA disposición que web/src/components/StampGrid.tsx: si cambia una, cambiar la otra.
export type StampSize = { w: number; h: number };
export const GOOGLE_HERO: StampSize = { w: 1032, h: 336 };
export const APPLE_STRIP: StampSize = { w: 1125, h: 432 };

const FONT = join(__dirname, "../../assets/Fredoka-SemiBold.ttf");
const DEFAULT_BG = "#FF9EC4";

// Mismo criterio que autoTextColor en web/src/lib/color.ts: blanco o verde de la marca,
// el que más contraste tenga con el fondo (Google Wallet hace lo mismo con su texto).
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function autoTextColor(bg: string): string {
  return contrast(bg, "#FFFFFF") >= contrast(bg, "#12372A") ? "#FFFFFF" : "#12372A";
}

type StampDesign = {
  total: number;
  bg: string;
  fg: string;
  iconId?: string;
  iconUrl?: string;
  bannerUrl?: string;
};

export function designOf(b: BusinessDoc): StampDesign {
  const bg = b.design?.bgColor ?? DEFAULT_BG;
  return {
    total: b.rule!.stampsRequired,
    bg,
    fg: autoTextColor(bg),
    iconId: b.design?.stampIconId,
    iconUrl: b.design?.stampIconUrl,
    bannerUrl: b.design?.bannerUrl,
  };
}

// Huella del diseño: si cambia algo, cambian las URLs y Google no muestra una imagen vieja de su caché.
function fingerprint(d: StampDesign): string {
  return createHash("sha1").update(JSON.stringify({ v: 1, ...d })).digest("hex").slice(0, 12);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export async function dataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export function buildSvg(d: StampDesign, filled: number, banner: string | null, icon: string | null, size: StampSize = GOOGLE_HERO): string {
  const { w: W, h: H } = size;
  const PAD = 28 * (W / GOOGLE_HERO.w);
  const rows = d.total <= 8 ? 1 : 2;
  const cols = Math.ceil(d.total / rows);
  const cellW = (W - PAD * 2) / cols;
  const cellH = (H - PAD * 2) / rows;
  const r = Math.min(Math.min(cellW, cellH) * 0.4, 62 * (W / GOOGLE_HERO.w));
  const presetIcon = STAMP_ICONS.find((i) => i.id === d.iconId) ?? CHECK_ICON;
  const iconSize = r * 1.15;
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="${d.bg}"/>`];

  if (banner) {
    parts.push(`<image href="${banner}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
    // Franja del color de fondo para que los sellos se lean sobre cualquier foto.
    const bandH = rows * cellH;
    parts.push(`<rect x="${PAD / 2}" y="${PAD}" width="${W - PAD}" height="${bandH}" rx="${r * 0.6}" fill="${d.bg}" fill-opacity="0.82"/>`);
  }

  for (let i = 0; i < d.total; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? d.total - cols * (rows - 1) : cols;
    const col = i - row * cols;
    const cx = PAD + (W - PAD * 2 - inRow * cellW) / 2 + cellW * (col + 0.5);
    const cy = PAD + cellH * (row + 0.5);
    const isFilled = i < filled;
    const isLast = i === d.total - 1;

    if (isFilled) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${d.fg}"/>`);
    } else {
      const rr = r - r * 0.05;
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${d.bg}" fill-opacity="0.85" stroke="${d.fg}" ` +
          `stroke-width="${r * 0.09}" stroke-dasharray="${r * 0.22} ${r * 0.16}"/>`,
      );
    }

    if (isLast) {
      parts.push(
        `<text x="${cx}" y="${cy + r * 0.14}" text-anchor="middle" fill="${isFilled ? d.bg : d.fg}" ` +
          `font-family="Fredoka" font-weight="600" font-size="${r * 0.4}">GRATIS</text>`,
      );
    } else if (isFilled && icon) {
      parts.push(
        `<clipPath id="c${i}"><circle cx="${cx}" cy="${cy}" r="${iconSize / 2}"/></clipPath>` +
          `<image href="${icon}" x="${cx - iconSize / 2}" y="${cy - iconSize / 2}" width="${iconSize}" height="${iconSize}" ` +
          `clip-path="url(#c${i})" preserveAspectRatio="xMidYMid meet"/>`,
      );
    } else if (isFilled) {
      const s = iconSize / 24;
      const paths = presetIcon.paths.map((p) => `<path d="${esc(p)}"/>`).join("");
      parts.push(
        `<g transform="translate(${cx - iconSize / 2} ${cy - iconSize / 2}) scale(${s})" fill="none" stroke="${d.bg}" ` +
          `stroke-width="${presetIcon.strokeWidth ?? 2}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join("")}</svg>`;
}

export function renderPng(svg: string, width?: number): Buffer {
  return new Resvg(svg, {
    font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: "Fredoka" },
    ...(width ? { fitTo: { mode: "width" as const, value: width } } : {}),
  }).render().asPng();
}

function publicUrl(bucket: string, path: string): string {
  // Lectura pública por storage.rules (businesses/{id}/generated/**): no hace falta token.
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

// Recursos ya descargados durante esta ejecución (para no bajar el banner una vez por estado).
type Assets = { banner: string | null; icon: string | null };

export class StampImages {
  private design: StampDesign;
  private hash: string;
  private assets: Promise<Assets> | null = null;

  constructor(private businessId: string, business: BusinessDoc) {
    this.design = designOf(business);
    this.hash = fingerprint(this.design);
  }

  private loadAssets(): Promise<Assets> {
    this.assets ??= Promise.all([
      this.design.bannerUrl ? dataUri(this.design.bannerUrl) : Promise.resolve(null),
      this.design.iconUrl ? dataUri(this.design.iconUrl) : Promise.resolve(null),
    ]).then(([banner, icon]) => ({ banner, icon }));
    return this.assets;
  }

  // Strip de Apple Wallet para `filled` sellos, en @1x/@2x/@3x (va adentro del .pkpass, no en Storage).
  async appleStrip(filled: number): Promise<Record<"strip.png" | "strip@2x.png" | "strip@3x.png", Buffer>> {
    const n = Math.max(0, Math.min(filled, this.design.total));
    const { banner, icon } = await this.loadAssets();
    const svg = buildSvg(this.design, n, banner, icon, APPLE_STRIP);
    return {
      "strip.png": renderPng(svg, APPLE_STRIP.w / 3),
      "strip@2x.png": renderPng(svg, (APPLE_STRIP.w * 2) / 3),
      "strip@3x.png": renderPng(svg, APPLE_STRIP.w),
    };
  }

  // URL de la imagen para `filled` sellos. Si no existe todavía, la genera y la sube.
  async urlFor(filled: number): Promise<string> {
    const n = Math.max(0, Math.min(filled, this.design.total));
    const bucket = getStorage().bucket();
    const path = `businesses/${this.businessId}/generated/${this.hash}/${n}-de-${this.design.total}.png`;
    const file = bucket.file(path);

    const [exists] = await file.exists();
    if (!exists) {
      const { banner, icon } = await this.loadAssets();
      const svg = buildSvg(this.design, n, banner, icon);
      const png = renderPng(svg);
      await file.save(png, { contentType: "image/png", metadata: { cacheControl: "public, max-age=31536000, immutable" } });
      logger.info("Imagen de sellos generada", { path });
    }
    return publicUrl(bucket.name, path);
  }
}
