import { todayAR } from "../birthday/rules";
import type { CardDoc } from "../types";

// Lo que el escáner cuenta del cliente al escanearlo, para que quien atiende lo trate según el caso
// (darle la bienvenida, un mimo al que hacía mucho que no venía, reconocer a los fieles).
// Se calcula con lo que ya tiene la tarjeta, antes de sumar el sello de esta visita.

export type Insight = { kind: "first" | "back" | "loyal" | "almost" | "anniversary"; text: string };

export type ClientFacts = {
  insights: Insight[];
  since: number | null; // ms de la fecha de alta
  visits: number; // aproximado: premios canjeados × sellos por tarjeta + sellos actuales
  lastVisitDays: number | null; // días desde la última visita (sello o canje)
};

const DAY = 86_400_000;
export const AWAY_DAYS = 30; // desde cuántos días sin venir se avisa
const LOYAL_REWARDS = 2; // desde cuántos premios canjeados es "cliente fiel"
const ANNIVERSARY_WINDOW = 3; // días antes y después del aniversario

const months = (days: number) => Math.floor(days / 30);

export function clientFacts(card: CardDoc, total: number, now = Date.now()): ClientFacts {
  const stamps = Math.min(card.stamps, total);
  const redeemed = card.rewardsRedeemed ?? 0;
  const created = card.createdAt?.toMillis?.() ?? null;
  const last = card.lastActivityAt?.toMillis?.() ?? card.lastStampAt?.toMillis?.() ?? created;
  const lastVisitDays = last !== null ? Math.floor((now - last) / DAY) : null;
  const visits = redeemed * total + stamps;
  const insights: Insight[] = [];

  if (visits === 0) {
    insights.push({ kind: "first", text: "Primera vez con tu tarjeta. ¡Dale la bienvenida!" });
  } else if (lastVisitDays !== null && lastVisitDays >= AWAY_DAYS) {
    const when = lastVisitDays >= 60 ? `${months(lastVisitDays)} meses` : `${lastVisitDays} días`;
    insights.push({ kind: "back", text: `Volvió después de ${when}. Buen momento para un mimo.` });
  }

  if (redeemed >= LOYAL_REWARDS) {
    insights.push({ kind: "loyal", text: `Cliente fiel: ya canjeó ${redeemed} premios.` });
  }

  if (stamps === total - 1) {
    insights.push({ kind: "almost", text: "Con este sello completa la tarjeta." });
  }

  if (created !== null) {
    const years = anniversaryYears(created, now);
    if (years > 0) insights.push({ kind: "anniversary", text: `Hace ${years} ${years === 1 ? "año" : "años"} que tiene tu tarjeta.` });
  }

  return { insights: insights.slice(0, 3), since: created, visits, lastVisitDays };
}

// Años cumplidos de cliente si hoy está a ±ANNIVERSARY_WINDOW días del aniversario; si no, 0.
function anniversaryYears(created: number, now: number): number {
  const t = todayAR(new Date(now));
  const c = todayAR(new Date(created));
  const years = t.year - c.year;
  for (const y of [years, years - 1, years + 1]) {
    if (y < 1) continue;
    const anniversary = Date.UTC(c.year + y, Number(c.m) - 1, Number(c.d));
    const today = Date.UTC(t.year, Number(t.m) - 1, Number(t.d));
    if (Math.abs(today - anniversary) <= ANNIVERSARY_WINDOW * DAY) return y;
  }
  return 0;
}
