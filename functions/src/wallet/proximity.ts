import { Timestamp } from "firebase-admin/firestore";
import type { BusinessDoc, CardDoc } from "../types";

// Cercanía y avisos del Wallet. Mismo texto que web/src/lib/proximity.ts (vista previa del editor).
//
// Google Wallet: las ubicaciones van en la clase (`merchantLocations`, máx. 10). Google decide cuándo
// mostrar el aviso y escribe su texto: el nuestro va en la tarjeta (módulo "Tu progreso").
// Apple Wallet (paso 7): cada ubicación lleva `relevantText` = proximityText(), y el campo de progreso
// lleva `changeMessage` para avisar al cambiar. Ver appleLocations().
// En ningún caso está garantizado que aparezca: depende del celular, la ubicación y los permisos.

export const MAX_LOCATIONS = 10;

// Lo que se cuenta, según la regla del negocio ("café" / "cafés"). Si no lo cargó, "sello" / "sellos".
export function itemNames(b: BusinessDoc): { singular: string; plural: string } {
  const singular = b.rule?.itemSingular?.trim() || "sello";
  const plural = b.rule?.itemPlural?.trim() || (b.rule?.itemSingular?.trim() ? `${singular}s` : "sellos");
  return { singular, plural };
}

// "Te faltan 3 cafés" / "Te falta 1 café" / "¡Tenés tu premio! Pasá a canjearlo".
export function proximityText(b: BusinessDoc, stamps: number): string {
  const remaining = Math.max(0, b.rule!.stampsRequired - stamps);
  if (remaining === 0) return "¡Tenés tu premio! Pasá a canjearlo";
  const { singular, plural } = itemNames(b);
  return remaining === 1 ? `Te falta 1 ${singular}` : `Te faltan ${remaining} ${plural}`;
}

// Ubicaciones válidas solo si el negocio activó la cercanía. Apagado o sin locales = ninguna.
export function activeLocations(b: BusinessDoc): { lat: number; lng: number; label?: string }[] {
  if (!b.proximityEnabled) return [];
  return (b.locations ?? [])
    .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng) && Math.abs(l.lat) <= 90 && Math.abs(l.lng) <= 180)
    .slice(0, MAX_LOCATIONS);
}

// Para el pass.json de Apple (paso 7).
export function appleLocations(b: BusinessDoc, stamps: number) {
  const relevantText = proximityText(b, stamps);
  return activeLocations(b).map((l) => ({ latitude: l.lat, longitude: l.lng, relevantText }));
}

// ---------- Límite de avisos ----------
// Google permite 3 avisos (push) por tarjeta cada 24 h. Apple no publica un número pero también
// limita. Guardamos cuándo avisamos en `walletNotifyAt` y reservamos el último lugar para el
// aviso de tarjeta completa, que es el más importante.
const NOTIFY_WINDOW_MS = 24 * 3600 * 1000;
const MAX_NOTIFY_PER_DAY = 3;

export type NotifyKind = "stamp" | "complete";

export function notifyDecision(card: CardDoc, kind: NotifyKind): { notify: boolean; log: Timestamp[] } {
  const now = Date.now();
  const recent = (card.walletNotifyAt ?? []).filter((t) => now - t.toMillis() < NOTIFY_WINDOW_MS);
  const limit = kind === "complete" ? MAX_NOTIFY_PER_DAY : MAX_NOTIFY_PER_DAY - 1;
  const notify = recent.length < limit;
  return { notify, log: notify ? [...recent, Timestamp.fromMillis(now)] : recent };
}
