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
  createdAt: Timestamp;
};

// Lo mínimo para que un cliente pueda sumarse (mismo criterio que enrollMissing en la web).
export function enrollMissing(b: BusinessDoc): string[] {
  const missing: string[] = [];
  if (!b.design?.logoUrl) missing.push("logo");
  if (!b.rule?.rewardText) missing.push("premio");
  return missing;
}
