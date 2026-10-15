import type { Customer } from "../types";

// Búsqueda de clientes en el panel. Firestore no busca texto, así que cada tarjeta guarda
// `searchTokens`: los prefijos de cada palabra del nombre, del mail y del teléfono (y sus últimos
// dígitos). El panel busca con array-contains. Misma lógica que web/src/lib/customers.ts.

export const CARDS_VERSION = 3; // sube cuando cambian los campos derivados de las tarjetas (v3: phoneKey/emailKey)
export const MAX_TOKEN = 15;
const MIN_TOKEN = 2;

export const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const prefixes = (s: string, min = MIN_TOKEN) => {
  const out: string[] = [];
  for (let i = min; i <= Math.min(s.length, MAX_TOKEN); i++) out.push(s.slice(0, i));
  return out;
};

// Teléfono sin el +54 / 9 / 0 del principio, para que "11 2345" encuentre "+54 9 11 2345 6789".
export function localPhoneDigits(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9") && d.length === 11) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

// Identidad del cliente para no duplicar tarjetas en un negocio: los últimos 8 dígitos del teléfono
// (así "011 15 2345-6789" y "+54 9 11 2345 6789" coinciden) y el mail en minúsculas.
export function identityKeys(c: Customer): { phoneKey?: string; emailKey?: string } {
  const digits = c.phone ? localPhoneDigits(c.phone) : "";
  const email = c.email?.trim().toLowerCase();
  return {
    ...(digits.length >= 8 ? { phoneKey: digits.slice(-8) } : {}),
    ...(email ? { emailKey: email } : {}),
  };
}

export function searchTokens(c: Customer): string[] {
  const tokens = new Set<string>();
  if (c.name) {
    for (const word of normalizeText(c.name).split(/\s+/)) prefixes(word).forEach((t) => tokens.add(t));
  }
  if (c.email) prefixes(normalizeText(c.email)).forEach((t) => tokens.add(t));
  if (c.phone) {
    const d = localPhoneDigits(c.phone);
    prefixes(d, 3).forEach((t) => tokens.add(t));
    for (let i = 4; i <= Math.min(d.length, MAX_TOKEN); i++) tokens.add(d.slice(-i)); // terminación
  }
  return [...tokens];
}
