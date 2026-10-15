import type { Timestamp } from 'firebase/firestore'

// Ver SELLITO_SPEC.md §6. Los campos que escriben solo las Functions son opcionales acá.
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled'

export type Business = {
  id: string
  ownerUid: string
  name: string
  slug?: string
  design?: {
    logoUrl?: string
    bannerUrl?: string
    bgColor?: string
    textColor?: string // ya no se usa: el color del texto es automático (autoTextColor)
    stampIconId?: string
    stampIconUrl?: string
  }
  rule?: { stampsRequired: number; rewardText: string }
  askFields?: { name: boolean; phone: boolean; email: boolean }
  locations?: { lat: number; lng: number; label: string }[]
  enrollCode?: string
  scannerPinVersion?: number // > 0 si el negocio ya eligió PIN (el hash lo escriben solo las Functions)
  subscription?: { status: SubscriptionStatus; plan?: string; currentPeriodEnd?: Timestamp }
  createdAt?: Timestamp
  updatedAt?: Timestamp
}
