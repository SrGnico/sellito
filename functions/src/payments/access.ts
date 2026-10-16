import type { Timestamp } from "firebase-admin/firestore";
import type { BusinessDoc, Subscription } from "../types";

// Reglas de la suscripción (SELLITO_SPEC.md §7 y paso 8). Cambiar los días acá.
export const GRACE_DAYS = 7; // días de gracia desde el primer cobro fallido
export const GRACE_WARNING_DAYS = 2; // aviso por mail cuando faltan estos días para que venza la gracia
export const ARCHIVE_AFTER_DAYS = 60; // días bloqueado antes de archivar
export const ARCHIVE_WARNING_DAYS = 7; // aviso por mail antes de archivar

export const DAY_MS = 86400000;

// Misma lógica que web/src/lib/subscription.ts y que canEdit() en firestore.rules.
//   none     → borrador (draft), nunca pagó: diseña y ve la vista previa; sin QR, Wallet, escáner ni clientes
//   full     → al día (activa o en prueba)
//   grace    → falló un cobro, sigue todo funcionando hasta graceUntil
//   blocked  → vencida: escáner pausado, panel en modo lectura
//   archived → bloqueada hace más de ARCHIVE_AFTER_DAYS (no se borra nada)
export type AccessLevel = "none" | "full" | "grace" | "blocked" | "archived";

const ms = (t: Timestamp | undefined) => t?.toMillis() ?? 0;

export function accessLevel(sub: Subscription | undefined, now = Date.now()): AccessLevel {
  switch (sub?.status) {
    case undefined:
    case "draft":
      return "none";
    case "active":
      return "full";
    case "trial":
      return ms(sub.trialEndsAt) > now ? "full" : "blocked"; // la prueba termina sin gracia
    case "past_due":
      return ms(sub.graceUntil) > now ? "grace" : "blocked";
    case "archived":
      return "archived";
    default:
      return "blocked"; // canceled
  }
}

// El escáner suma sellos y el Wallet se actualiza.
export const canOperate = (level: AccessLevel) => level === "full" || level === "grace";
// El dueño puede editar diseño, regla y PIN.
export const canEdit = (level: AccessLevel) => level !== "blocked" && level !== "archived";
// Borrador: todavía no pagó, así que no hay QR ni tarjetas emitidas. La tarjeta de ejemplo de la landing no cuenta.
export const isDraft = (b: Pick<BusinessDoc, "subscription" | "demo">) => !b.demo && accessLevel(b.subscription) === "none";
