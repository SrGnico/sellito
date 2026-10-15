import { isHexColor } from './color'

// Datos que la persona escribió en la landing antes de crear la cuenta (?negocio=…&color=…).
// Se guardan en la pestaña hasta que crea el negocio.
const KEY = 'sellito-prefill'

export type Prefill = { name?: string; color?: string }

export function saveSignupPrefill(search: string) {
  const q = new URLSearchParams(search)
  const name = q.get('negocio')?.trim().slice(0, 80)
  const color = q.get('color')?.toUpperCase()
  if (!name && !color) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ name: name || undefined, color: color && isHexColor(color) ? color : undefined }))
  } catch {
    // sin almacenamiento: se pierde el autocompletado, nada más
  }
}

export function readSignupPrefill(): Prefill {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Prefill
  } catch {
    return {}
  }
}

export function clearSignupPrefill() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nada
  }
}
