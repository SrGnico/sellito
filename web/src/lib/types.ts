import type { Timestamp } from 'firebase/firestore'

// Ver SELLITO_SPEC.md §6. Los campos que escriben solo las Functions son opcionales acá.
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'archived'

// Solo la escriben las Functions (functions/src/types.ts tiene todos los campos).
export type Subscription = {
  status?: SubscriptionStatus
  plan?: string
  amount?: number
  currency?: string
  pendingPreapprovalId?: string
  payerEmail?: string // mail de la cuenta de Mercado Pago que paga
  currentPeriodEnd?: Timestamp
  cancelAtPeriodEnd?: boolean
  trialEndsAt?: Timestamp
  graceUntil?: Timestamp
  blockedAt?: Timestamp
}

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
  // itemSingular/itemPlural: lo que se cuenta ("café" / "cafés"), para "Te faltan 3 cafés".
  rule?: { stampsRequired: number; rewardText: string; itemSingular?: string; itemPlural?: string; conditions?: string }
  askFields?: { name: boolean; phone: boolean; email: boolean }
  locations?: BusinessLocation[]
  proximityEnabled?: boolean // mostrar la tarjeta cerca de los locales (functions/src/wallet/proximity.ts)
  enrollCode?: string
  scannerPinVersion?: number // > 0 si el negocio ya eligió PIN (el hash lo escriben solo las Functions)
  subscription?: Subscription
  cardsVersion?: number
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

// businesses/{id}/cards/{cardId}: la escriben solo las Functions; el dueño la lee.
export type Card = {
  id: string
  customer: { name?: string; phone?: string; email?: string }
  stamps: number
  rewardsAvailable: number
  rewardsRedeemed: number
  codeSuffix?: string
  lastStampAt?: Timestamp
  lastActivityAt?: Timestamp
  consent?: { marketing: boolean; at: Timestamp; version: string }
  createdAt?: Timestamp
}

export type StampEvent = {
  id: string
  cardId: string
  type: 'add' | 'redeem' | 'test'
  at?: Timestamp
  stampsAfter: number
  forced?: boolean
}

// Local del negocio (máx. 10) para la cercanía en el Wallet.
export type BusinessLocation = { label: string; address?: string; lat: number; lng: number }
