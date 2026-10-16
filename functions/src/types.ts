import type { Timestamp } from "firebase-admin/firestore";

// Ver SELLITO_SPEC.md §6 (mismo modelo que web/src/lib/types.ts).
export type BusinessDoc = {
  ownerUid: string;
  name: string;
  design?: {
    logoUrl?: string;
    // Logo horizontal que ya incluye el nombre: si está, la tarjeta lo muestra en lugar de logo + nombre.
    wideLogoUrl?: string;
    bannerUrl?: string;
    bgColor?: string;
    textColor?: string;
    stampIconId?: string;
    stampIconUrl?: string; // imagen propia en uso como sello
    customStampUrl?: string; // imagen propia subida: se conserva aunque elija un ícono de la lista
  };
  // itemSingular/itemPlural: lo que se cuenta ("café" / "cafés"), para "Te faltan 3 cafés".
  // conditions: reglas del negocio para sumar sellos ("un sello por compra mayor a $5.000"), opcional.
  rule?: { stampsRequired: number; rewardText: string; itemSingular?: string; itemPlural?: string; conditions?: string };
  // Locales (máx. 10) y si la tarjeta los usa para aparecer cerca (wallet/proximity.ts).
  locations?: { label?: string; address?: string; lat: number; lng: number }[];
  proximityEnabled?: boolean;
  askFields?: { name: boolean; phone: boolean; email: boolean; birthday?: boolean };
  birthday?: BirthdayConfig; // regalo y saludo de cumpleaños (birthday/index.ts)
  // De qué campaña llegó (lo guarda la web al crear el negocio; web/src/lib/attribution.ts).
  attribution?: Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "fbclid" | "fbc" | "fbp" | "landing" | "ua", string>> & { at?: Timestamp };
  googleClassId?: string;
  enrollCode?: string;
  demo?: boolean; // tarjeta de ejemplo de la landing (Sellito), no es un negocio real
  scannerPinHash?: string;
  scannerPinVersion?: number;
  subscription?: Subscription;
  cardsVersion?: number; // CARDS_VERSION cuando todas las tarjetas tienen los campos de búsqueda
};

// Regalo de cumpleaños: vale el día del cumple o todo ese mes; regala el mismo premio de la tarjeta,
// otro (rewardText) o nada (solo saludo); notify: aviso al celular ese día (o el 1° del mes).
export type BirthdayConfig = {
  enabled: boolean;
  when: "day" | "month";
  reward: "same" | "custom" | "none";
  rewardText?: string;
  notify: boolean;
};

// Solo la escriben las Functions (Mercado Pago, tarea diaria). Ver payments/access.ts.
// draft: se registró y arma su tarjeta, todavía no pagó. trial ya no se usa en altas nuevas (queda por si vuelve).
export type SubscriptionStatus = "draft" | "trial" | "active" | "past_due" | "canceled" | "archived";

export type Subscription = {
  status?: SubscriptionStatus;
  plan?: string; // id en config/plans ("monthly"; más adelante "annual")
  amount?: number; // precio con el que se suscribió: cambiar config/plans no toca a los que ya están
  currency?: string;
  mpPreapprovalId?: string; // suscripción vigente en Mercado Pago
  mpStatus?: string;
  pendingPreapprovalId?: string; // checkout en curso (reactivar o cambiar el medio de pago)
  pendingPlan?: string;
  payerEmail?: string; // mail de la cuenta de Mercado Pago que paga (lo eligió el dueño)
  pendingAmount?: number;
  failedPreapprovalId?: string; // la suscripción cuyo cobro falló (pasa a past_due)
  currentPeriodEnd?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: Timestamp;
  graceUntil?: Timestamp;
  blockedAt?: Timestamp;
  archivedAt?: Timestamp;
  draftAt?: Timestamp; // cuándo se registró (pasó a borrador)
  activatedAt?: Timestamp; // primera vez que pagó; no cambia al reactivar (para medir cuántos activan)
  // Mails ya enviados en el ciclo actual (se limpian al volver a estar al día).
  notices?: Partial<Record<"draftReminder" | "pastDue" | "graceEnding" | "blocked" | "archiveWarning" | "archived", Timestamp>>;
  updatedAt?: Timestamp;
};

export type Customer = { name?: string; phone?: string; email?: string; birthday?: string }; // birthday: AAAA-MM-DD

export type CardDoc = {
  customer: Customer;
  stamps: number;
  rewardsAvailable: number;
  rewardsRedeemed: number;
  barcodeValue: string;
  codeSuffix?: string;
  phoneKey?: string; // identityKeys(): para no duplicar tarjetas del mismo cliente
  emailKey?: string; // últimos 4 de barcodeValue, para buscar a mano en el escáner
  platform: "google" | "apple";
  appleAuthToken?: string; // authenticationToken del pase (web service de Apple)
  appleUpdatedAt?: number; // ms de la última versión del pase (passesUpdatedSince)
  appleNotify?: boolean;
  appleNotice?: { title: string; body: string; at: number }; // último aviso del negocio (campo "Novedades" del pase) // si la versión actual avisa al cliente (changeMessage)
  googleObjectId?: string;
  lastStampAt?: Timestamp;
  walletNotifyAt?: Timestamp[]; // avisos push enviados (últimas 24 h), ver wallet/proximity.ts
  lastActivityAt?: Timestamp; // último sello o canje; al crearla, la fecha de alta (filtro "inactivos")
  searchTokens?: string[]; // prefijos de nombre, teléfono y mail para buscar (cards/search.ts)
  consent?: { marketing: boolean; at: Timestamp; version: string }; // aceptación de novedades del negocio
  birthdayMD?: string; // "MM-DD" del cumpleaños (para buscar a quién saludar)
  birthdayM?: string; // "MM"
  birthdayRedeemedYear?: number; // año en que ya recibió el regalo de cumpleaños
  birthdayNotifiedYear?: number; // año en que ya se le mandó el saludo
  createdAt: Timestamp;
};

// Lo mínimo para que un cliente pueda sumarse (mismo criterio que enrollMissing en la web).
export function enrollMissing(b: BusinessDoc): string[] {
  const missing: string[] = [];
  if (!b.design?.logoUrl) missing.push("logo");
  if (!b.rule?.rewardText) missing.push("premio");
  return missing;
}
