import { getFirestore, Timestamp, type Query } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { CARDS_VERSION, localPhoneDigits, MAX_TOKEN, normalizeText, searchTokens } from "../cards/search";
import type { BusinessDoc, CardDoc } from "../types";

// Clientes del negocio (panel → Clientes). Mismos filtros que web/src/lib/customers.ts.
// Exportar funciona también con la suscripción vencida: los datos son del negocio.

const db = () => getFirestore();

export const INACTIVE_DAYS = 30;
export const NEW_DAYS = 7;
export type CustomerFilter = "all" | "reward" | "inactive" | "new";

async function ownedBusiness(uid: string | undefined, businessId: unknown): Promise<BusinessDoc> {
  if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  if (typeof businessId !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(businessId)) {
    throw new HttpsError("invalid-argument", "Negocio inválido.");
  }
  const snap = await db().doc(`businesses/${businessId}`).get();
  if (!snap.exists || snap.get("ownerUid") !== uid) throw new HttpsError("permission-denied", "Este negocio no es tuyo.");
  return snap.data() as BusinessDoc;
}

// Completa en las tarjetas viejas los campos que usan la búsqueda y los filtros.
async function upgradeBusinessCards(businessId: string): Promise<number> {
  const snap = await db().collection(`businesses/${businessId}/cards`).get();
  let writer = db().batch();
  let pending = 0;
  let updated = 0;
  for (const doc of snap.docs) {
    const c = doc.data() as CardDoc;
    const patch: Record<string, unknown> = {};
    const tokens = searchTokens(c.customer ?? {});
    if (JSON.stringify(c.searchTokens ?? []) !== JSON.stringify(tokens)) patch.searchTokens = tokens;
    if (!c.lastActivityAt) patch.lastActivityAt = c.lastStampAt ?? c.createdAt ?? Timestamp.now();
    if (Object.keys(patch).length === 0) continue;
    writer.update(doc.ref, patch);
    updated++;
    if (++pending === 400) {
      await writer.commit();
      writer = db().batch();
      pending = 0;
    }
  }
  if (pending > 0) await writer.commit();
  await db().doc(`businesses/${businessId}`).update({ cardsVersion: CARDS_VERSION });
  return updated;
}

// El panel la llama una vez si el negocio tiene cardsVersion viejo.
export const upgradeCards = onCall({ timeoutSeconds: 300 }, async (req) => {
  const businessId = req.data?.businessId;
  const b = await ownedBusiness(req.auth?.uid, businessId);
  if (b.cardsVersion === CARDS_VERSION) return { updated: 0 };
  const updated = await upgradeBusinessCards(businessId);
  logger.info("Tarjetas actualizadas para la búsqueda", { businessId, updated });
  return { updated };
});

// ---------- Exportar contactos (CSV) ----------

// Separador ";" porque Excel en español toma la coma como decimal; BOM para que abra bien los acentos.
const SEP = ";";
const BOM = "﻿";

function cell(v: string | number): string {
  let s = String(v);
  if (/^[=@]/.test(s) || /^[+-][^\d\s]/.test(s)) s = `'${s}`; // evita que Excel lo tome como fórmula
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const fmtDate = (t: Timestamp | undefined) =>
  t ? t.toDate().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : "";

export const exportCustomers = onCall({ timeoutSeconds: 120, memory: "512MiB" }, async (req) => {
  const { businessId, filter = "all", search = "" } = req.data ?? {};
  const b = await ownedBusiness(req.auth?.uid, businessId);
  if (!["all", "reward", "inactive", "new"].includes(filter) || typeof search !== "string" || search.length > 100) {
    throw new HttpsError("invalid-argument", "Filtro inválido.");
  }
  if (b.cardsVersion !== CARDS_VERSION) await upgradeBusinessCards(businessId);

  // Igual que la lista del panel: si hay búsqueda, se ignoran los filtros.
  const words = normalizeText(search).split(/\s+/).filter(Boolean);
  let q: Query = db().collection(`businesses/${businessId}/cards`);
  if (words.length > 0) {
    q = q.where("searchTokens", "array-contains", searchToken(words[0]));
  } else if (filter === "reward") {
    q = q.where("rewardsAvailable", "==", 1);
  } else if (filter === "inactive") {
    q = q.where("lastActivityAt", "<", Timestamp.fromMillis(Date.now() - INACTIVE_DAYS * 86400000));
  } else if (filter === "new") {
    q = q.where("createdAt", ">=", Timestamp.fromMillis(Date.now() - NEW_DAYS * 86400000));
  }

  const snap = await q.get();
  const cards = snap.docs
    .map((d) => d.data() as CardDoc)
    .filter((c) => words.slice(1).every((w) => matchesWord(c, w)))
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));

  const ask = b.askFields ?? { name: true, phone: true, email: false };
  const columns: [string, (c: CardDoc) => string | number][] = [];
  if (ask.name) columns.push(["Nombre", (c) => c.customer?.name ?? ""]);
  if (ask.phone) columns.push(["Teléfono", (c) => c.customer?.phone ?? ""]);
  if (ask.email) columns.push(["Mail", (c) => c.customer?.email ?? ""]);
  columns.push(
    ["Sellos", (c) => c.stamps],
    ["Premios canjeados", (c) => c.rewardsRedeemed ?? 0],
    ["Fecha de alta", (c) => fmtDate(c.createdAt)],
    ["Acepta novedades", (c) => (c.consent ? (c.consent.marketing ? "Sí" : "No") : "")],
  );

  const lines = [columns.map(([h]) => cell(h)).join(SEP), ...cards.map((c) => columns.map(([, get]) => cell(get(c))).join(SEP))];
  const day = new Date().toISOString().slice(0, 10);
  logger.info("Exportación de contactos", { businessId, filter, searching: words.length > 0, rows: cards.length });
  return { filename: `clientes-${day}.csv`, csv: BOM + lines.join("\r\n") + "\r\n", rows: cards.length };
});

// Palabra buscada → token (misma lógica que web/src/lib/customers.ts).
export function searchToken(word: string): string {
  const digits = word.replace(/[\s\-().+]/g, "");
  // Solo un número completo trae +54/9/0 adelante; "5432" puede ser la terminación.
  if (/^\d+$/.test(digits)) return (digits.length >= 10 ? localPhoneDigits(digits) : digits.replace(/^0+/, "")).slice(0, MAX_TOKEN);
  return word.slice(0, MAX_TOKEN);
}

function matchesWord(c: CardDoc, word: string): boolean {
  return (c.searchTokens ?? []).includes(searchToken(word));
}
