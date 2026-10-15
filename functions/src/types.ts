import type { Timestamp } from "firebase-admin/firestore";

// Ver SELLITO_SPEC.md §6 (mismo modelo que web/src/lib/types.ts).
export type BusinessDoc = {
  ownerUid: string;
  name: string;
  design?: {
    logoUrl?: string;
    bannerUrl?: string;
    bgColor?: string;
    textColor?: string;
    stampIconId?: string;
    stampIconUrl?: string;
  };
  rule?: { stampsRequired: number; rewardText: string };
  askFields?: { name: boolean; phone: boolean; email: boolean };
  googleClassId?: string;
  enrollCode?: string;
  scannerPinHash?: string;
  scannerPinVersion?: number;
  subscription?: Subscription;
  cardsVersion?: number; // CARDS_VERSION cuando todas las tarjetas tienen los campos de búsqueda
};

// Solo la escriben las Functions (Mercado Pago, tarea diaria). Ver payments/access.ts.
export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "archived";

export type Subscription = {
  status?: SubscriptionStatus;
  plan?: string; // id en config/plans ("monthly"; más adelante "annual")
  amount?: number; // precio con el que se suscribió: cambiar config/plans no toca a los que ya están
  currency?: string;
  mpPreapprovalId?: string; // suscripción vigente en Mercado Pago
  mpStatus?: string;
  pendingPreapprovalId?: string; // checkout en curso (reactivar o cambiar el medio de pago)
  pendingPlan?: string;
  pendingAmount?: number;
  failedPreapprovalId?: string; // la suscripción cuyo cobro falló (pasa a past_due)
  currentPeriodEnd?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: Timestamp;
  graceUntil?: Timestamp;
  blockedAt?: Timestamp;
  archivedAt?: Timestamp;
  // Mails ya enviados en el ciclo actual (se limpian al volver a estar al día).
  notices?: Partial<Record<"pastDue" | "graceEnding" | "blocked" | "archiveWarning" | "archived", Timestamp>>;
  updatedAt?: Timestamp;
};

export type Customer = { name?: string; phone?: string; email?: string };

export type CardDoc = {
  customer: Customer;
  stamps: number;
  rewardsAvailable: number;
  rewardsRedeemed: number;
  barcodeValue: string;
  codeSuffix?: string; // últimos 4 de barcodeValue, para buscar a mano en el escáner
  platform: "google" | "apple";
  googleObjectId?: string;
  lastStampAt?: Timestamp;
  lastActivityAt?: Timestamp; // último sello o canje; al crearla, la fecha de alta (filtro "inactivos")
  searchTokens?: string[]; // prefijos de nombre, teléfono y mail para buscar (cards/search.ts)
  consent?: { marketing: boolean; at: Timestamp; version: string }; // aceptación de novedades del negocio
  createdAt: Timestamp;
};

// Lo mínimo para que un cliente pueda sumarse (mismo criterio que enrollMissing en la web).
export function enrollMissing(b: BusinessDoc): string[] {
  const missing: string[] = [];
  if (!b.design?.logoUrl) missing.push("logo");
  if (!b.rule?.rewardText) missing.push("premio");
  return missing;
}
