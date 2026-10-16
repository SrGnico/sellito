import type { BirthdayConfig, BusinessDoc, CardDoc } from "../types";

// Cumpleaños de los clientes (opcional, lo pide el negocio en askFields.birthday).
//   customer.birthday = "AAAA-MM-DD" (lo que cargó el cliente)
//   birthdayMD = "MM-DD" y birthdayM = "MM" (en la tarjeta, para buscar a quién saludar)
// El negocio configura en b.birthday si hay regalo, cuándo vale (el día o todo el mes), qué regala
// (el mismo premio, otro o nada) y si se avisa al celular. Ver web/src/lib/birthday.ts (misma lógica).

export const TZ = "America/Argentina/Buenos_Aires";

// Fecha de hoy en Argentina: { ymd: "AAAA-MM-DD", md: "MM-DD", m: "MM", d: "DD", year }.
export function todayAR(now = new Date()) {
  const ymd = now.toLocaleDateString("en-CA", { timeZone: TZ });
  return { ymd, md: ymd.slice(5), m: ymd.slice(5, 7), d: ymd.slice(8), year: Number(ymd.slice(0, 4)) };
}

// Valida lo que mandó el cliente: fecha real, no futura, desde 1900. Devuelve "AAAA-MM-DD" o null.
export function parseBirthday(input: unknown, now = new Date()): string | null {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const [y, m, d] = input.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900 || input > todayAR(now).ymd) return null;
  return input;
}

// Campos de la tarjeta que salen del cumpleaños.
export function birthdayFields(birthday: string | undefined) {
  return birthday ? { birthdayMD: birthday.slice(5), birthdayM: birthday.slice(5, 7) } : {};
}

// Qué se regala (texto) o null si solo se saluda.
export function birthdayGift(b: BusinessDoc): string | null {
  const c = b.birthday;
  if (!c?.enabled || c.reward === "none") return null;
  if (c.reward === "custom") return c.rewardText?.trim() || null;
  return b.rule?.rewardText ?? null;
}

// Línea para los detalles de la tarjeta ("En tu cumpleaños: …") o null si no hay regalo.
export function birthdayPerk(b: BusinessDoc): string | null {
  const gift = birthdayGift(b);
  if (!gift) return null;
  return b.birthday?.when === "month" ? `Te regalamos ${gift} durante todo el mes de tu cumple.` : `Te regalamos ${gift} el día de tu cumple.`;
}

// ¿El cliente está "de cumple" hoy, según la configuración? (el día exacto o todo el mes)
export function isBirthdayNow(c: BirthdayConfig | undefined, card: Pick<CardDoc, "birthdayMD">, now = new Date()): boolean {
  if (!c?.enabled || !card.birthdayMD) return false;
  const t = todayAR(now);
  // Los del 29/2 festejan el 28/2 en los años que no son bisiestos.
  const md = card.birthdayMD === "02-29" && !isLeap(t.year) ? "02-28" : card.birthdayMD;
  return c.when === "month" ? md.slice(0, 2) === t.m : md === t.md;
}

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// Lo que ve el escáner: si está de cumple, si ya recibió el regalo este año y qué regalo es.
export function birthdayStatus(b: BusinessDoc, card: CardDoc, now = new Date()) {
  if (!isBirthdayNow(b.birthday, card, now)) return null;
  const gift = birthdayGift(b);
  return { gift, redeemed: card.birthdayRedeemedYear === todayAR(now).year };
}

// Texto del aviso al celular.
export function birthdayMessage(b: BusinessDoc, card: CardDoc): { title: string; body: string } {
  const first = card.customer?.name?.split(/\s+/)[0];
  const title = first ? `¡Feliz cumple, ${first}!` : "¡Feliz cumple!";
  const gift = birthdayGift(b);
  const when = b.birthday?.when === "month" ? "durante todo tu mes" : "hoy";
  const body = gift
    ? `En ${b.name} te regalamos ${gift} ${when}. Mostrá tu tarjeta para usarlo.`
    : `Todo el equipo de ${b.name} te desea un muy feliz cumpleaños.`;
  return { title: title.slice(0, 40), body: body.slice(0, 140) };
}
