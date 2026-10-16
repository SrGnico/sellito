import { DEFAULT_BIRTHDAY } from './birthday'
import type { BirthdayConfig, Business, BusinessLocation } from './types'

// Todo lo que define cómo se ve la tarjeta, con los valores por defecto ya aplicados.
export type CardConfig = {
  name: string
  logoUrl?: string
  wideLogoUrl?: string
  bannerUrl?: string
  bgColor: string
  stampIconId?: string
  stampIconUrl?: string
  customStampUrl?: string
  stampsRequired: number
  rewardText: string
  itemSingular: string
  itemPlural: string
  conditions: string
  askFields: { name: boolean; phone: boolean; email: boolean; birthday?: boolean }
  birthday?: BirthdayConfig
  locations: BusinessLocation[]
  proximityEnabled: boolean
}

export const MIN_STAMPS = 2
export const MAX_STAMPS = 20 // mismos límites que firestore.rules

export const DEFAULT_CARD = {
  bgColor: '#FF9EC4',
  stampsRequired: 6,
  rewardText: '',
  askFields: { name: true, phone: true, email: false },
}

export function cardConfigFrom(b: Business): CardConfig {
  return {
    name: b.name,
    logoUrl: b.design?.logoUrl,
    wideLogoUrl: b.design?.wideLogoUrl,
    bannerUrl: b.design?.bannerUrl,
    bgColor: b.design?.bgColor ?? DEFAULT_CARD.bgColor,
    stampIconId: b.design?.stampIconId,
    stampIconUrl: b.design?.stampIconUrl,
    customStampUrl: b.design?.customStampUrl ?? b.design?.stampIconUrl,
    stampsRequired: b.rule?.stampsRequired ?? DEFAULT_CARD.stampsRequired,
    rewardText: b.rule?.rewardText ?? DEFAULT_CARD.rewardText,
    itemSingular: b.rule?.itemSingular ?? '',
    itemPlural: b.rule?.itemPlural ?? '',
    conditions: b.rule?.conditions ?? '',
    askFields: b.askFields ?? DEFAULT_CARD.askFields,
    birthday: b.birthday ?? DEFAULT_BIRTHDAY,
    locations: b.locations ?? [],
    proximityEnabled: b.proximityEnabled ?? false,
  }
}

// Lo mínimo para que un cliente pueda sumarse. Mismo criterio que enrollMissing en functions/src/types.ts
// (Google Wallet exige logo).
export function enrollMissing(b: Business): string[] {
  const missing: string[] = []
  if (!b.design?.logoUrl) missing.push('el logo')
  if (!b.rule?.rewardText) missing.push('el premio')
  return missing
}

// Firestore rechaza `undefined`: se omiten las claves vacías.
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>
}

// Solo campos que el dueño puede escribir (ver ownerEditableFields en firestore.rules).
export function businessFieldsFrom(c: CardConfig) {
  return {
    name: c.name.trim(),
    design: compact({
      logoUrl: c.logoUrl,
      wideLogoUrl: c.wideLogoUrl,
      bannerUrl: c.bannerUrl,
      bgColor: c.bgColor,
      stampIconId: c.stampIconId,
      stampIconUrl: c.stampIconUrl,
      customStampUrl: c.customStampUrl,
    }),
    rule: {
      stampsRequired: Math.round(c.stampsRequired),
      rewardText: c.rewardText.trim(),
      ...compact({ itemSingular: c.itemSingular.trim(), itemPlural: c.itemPlural.trim(), conditions: c.conditions.trim() }),
    },
    askFields: c.askFields,
    ...(c.birthday
      ? { birthday: compact({ ...c.birthday, rewardText: c.birthday.reward === 'custom' ? c.birthday.rewardText?.trim() : undefined }) as BirthdayConfig }
      : {}),
    locations: c.locations.map((l) => ({ label: l.label.trim(), lat: l.lat, lng: l.lng, ...compact({ address: l.address }) })),
    proximityEnabled: c.proximityEnabled,
  }
}
