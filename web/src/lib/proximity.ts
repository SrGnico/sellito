import type { CardConfig } from './cardDesign'

// Texto de cercanía: el mismo que emite el backend (functions/src/wallet/proximity.ts).
// Sale de la regla del negocio: lo que se cuenta ("café" / "cafés") y cuántos faltan.
export function itemNames(c: Pick<CardConfig, 'itemSingular' | 'itemPlural'>) {
  const singular = c.itemSingular.trim() || 'sello'
  const plural = c.itemPlural.trim() || (c.itemSingular.trim() ? `${singular}s` : 'sellos')
  return { singular, plural }
}

export function proximityText(c: Pick<CardConfig, 'itemSingular' | 'itemPlural' | 'stampsRequired'>, stamps: number): string {
  const remaining = Math.max(0, c.stampsRequired - stamps)
  if (remaining === 0) return '¡Tenés tu premio! Pasá a canjearlo'
  const { singular, plural } = itemNames(c)
  return remaining === 1 ? `Te falta 1 ${singular}` : `Te faltan ${remaining} ${plural}`
}

export const MAX_LOCATIONS = 10
