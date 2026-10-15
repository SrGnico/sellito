import { randomBytes } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";

// Código de la tarjeta (lo que codifica el QR y lee el escáner): 12 caracteres al azar.
// En mayúsculas para que el QR use el modo alfanumérico (el más liviano) y sin 0/O, 1/I/L
// para que se pueda dictar o tipear sin confusiones. 31^12 ≈ 8·10^17 combinaciones.
export const CARD_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CARD_CODE_LENGTH = 12;

function randomCardCode(): string {
  // Rechazo de bytes ≥ 248 para no sesgar la distribución (248 = 31 × 8).
  let out = "";
  while (out.length < CARD_CODE_LENGTH) {
    for (const n of randomBytes(CARD_CODE_LENGTH * 2)) {
      if (n < 248 && out.length < CARD_CODE_LENGTH) out += CARD_CODE_ALPHABET[n % 31];
    }
  }
  return out;
}

// Lo que se ve en la tarjeta (bajo el QR y como "ID de miembro"): los últimos 4 caracteres.
// El QR lleva el código completo; si la cámara falla, el local tipea estos 4 en el escáner y,
// si dos tarjetas del negocio terminan igual, elige por nombre.
export const CARD_CODE_SUFFIX_LENGTH = 4;

export function cardCodeSuffix(code: string): string {
  return code.slice(-CARD_CODE_SUFFIX_LENGTH);
}

// Normaliza lo que tipea el local en el escáner (minúsculas, guiones, espacios).
export function normalizeCardCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

// Reserva un código único dentro del negocio: businesses/{id}/codes/{código} → cardId.
// Se llama dentro de una transacción para que dos altas simultáneas no se pisen.
export async function reserveCardCode(db: Firestore, tx: Transaction, businessId: string, cardId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCardCode();
    const ref = db.doc(`businesses/${businessId}/codes/${code}`);
    if ((await tx.get(ref)).exists) continue;
    tx.create(ref, { cardId });
    return code;
  }
  throw new Error("No se pudo reservar un código único");
}
