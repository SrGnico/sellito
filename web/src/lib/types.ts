import type { Timestamp } from 'firebase/firestore'
import type { Attribution } from './attribution'

// Ver SELLITO_SPEC.md §6. Los campos que escriben solo las Functions son opcionales acá.
// draft: se registró y arma su tarjeta, todavía no pagó. trial ya no se asigna (queda por si vuelve).
export type SubscriptionStatus = 'draft' | 'trial' | 'active' | 'past_due' | 'canceled' | 'archived'

// Solo la escriben las Functions (functions/src/types.ts tiene todos los campos).
export type Subscription = {
  status?: SubscriptionStatus
  plan?: string
  amount?: number
  currency?: string
  mpPreapprovalId?: string // suscripción vigente en Mercado Pago
  pendingPreapprovalId?: string
  payerEmail?: string // mail de la cuenta de Mercado Pago que paga
  currentPeriodEnd?: Timestamp
  cancelAtPeriodEnd?: boolean
  trialEndsAt?: Timestamp
  graceUntil?: Timestamp
  blockedAt?: Timestamp
  draftAt?: Timestamp
  activatedAt?: Timestamp // primera vez que pagó
  updatedAt?: Timestamp
}

export type Business = {
  id: string
  ownerUid: string
  demo?: boolean // tarjeta de ejemplo de la landing, no es un negocio real
  name: string
  slug?: string
  design?: {
    logoUrl?: string
    wideLogoUrl?: string // logo horizontal con el nombre: reemplaza logo + nombre en la tarjeta
    bannerUrl?: string
    bgColor?: string
    textColor?: string // ya no se usa: el color del texto es automático (autoTextColor)
    stampIconId?: string
    stampIconUrl?: string // imagen propia en uso como sello
    customStampUrl?: string // imagen propia subida: se conserva aunque elija un ícono de la lista
  }
  // itemSingular/itemPlural: lo que se cuenta ("café" / "cafés"), para "Te faltan 3 cafés".
  rule?: { stampsRequired: number; rewardText: string; itemSingular?: string; itemPlural?: string; conditions?: string }
  askFields?: { name: boolean; phone: boolean; email: boolean; birthday?: boolean }
  birthday?: BirthdayConfig // regalo y saludo de cumpleaños (lib/birthday.ts)
  attribution?: Attribution & { at?: Timestamp } // de qué campaña llegó (lib/attribution.ts)
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
// Mismo modelo que functions/src/types.ts (BirthdayConfig).
export type BirthdayConfig = {
  enabled: boolean
  when: 'day' | 'month'
  reward: 'same' | 'custom' | 'none'
  rewardText?: string
  notify: boolean
}

export type Card = {
  id: string
  customer: { name?: string; phone?: string; email?: string; birthday?: string } // birthday: AAAA-MM-DD
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
