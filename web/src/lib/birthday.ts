import type { BirthdayConfig } from './types'

// Regalo de cumpleaños: misma lógica que functions/src/birthday/rules.ts.

export const DEFAULT_BIRTHDAY: BirthdayConfig = { enabled: false, when: 'day', reward: 'same', notify: true }

// Qué se regala, o null si solo se saluda.
export function birthdayGift(c: BirthdayConfig | undefined, rewardText: string): string | null {
  if (!c?.enabled || c.reward === 'none') return null
  if (c.reward === 'custom') return c.rewardText?.trim() || null
  return rewardText.trim() || null
}

// Frase para mostrar al cliente y en la landing de la tarjeta.
export function birthdayPerk(c: BirthdayConfig | undefined, rewardText: string): string | null {
  const gift = birthdayGift(c, rewardText)
  if (!gift) return null
  return c?.when === 'month' ? `Te regalamos ${gift} durante todo el mes de tu cumple.` : `Te regalamos ${gift} el día de tu cumple.`
}

// Ejemplo del aviso que llega al celular (functions/src/birthday/rules.ts, birthdayMessage).
export function birthdayPreview(c: BirthdayConfig | undefined, business: string, rewardText: string) {
  const gift = birthdayGift(c, rewardText)
  const when = c?.when === 'month' ? 'durante todo tu mes' : 'hoy'
  return {
    title: '¡Feliz cumple, Martina! 🎂',
    body: gift
      ? `En ${business || 'tu negocio'} te regalamos ${gift} ${when}. Mostrá tu tarjeta para usarlo.`
      : `Todo el equipo de ${business || 'tu negocio'} te desea un muy feliz cumpleaños.`,
  }
}

// "AAAA-MM-DD" → "15/10/1990"
export const formatBirthday = (b: string | undefined) => (b ? b.split('-').reverse().join('/') : '')
