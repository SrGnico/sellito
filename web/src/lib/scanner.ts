import { FirebaseError } from 'firebase/app'
import { callable } from './firebase'

// Escáner del local: entra con el PIN del negocio y guarda un token de sesión en este celular.
// Ver functions/src/scanner/index.ts.

export type ScannerBusiness = {
  name: string
  stampsRequired: number
  rewardText: string
  design: { bgColor?: string; stampIconId?: string; stampIconUrl?: string }
}

export type ScannedCard = {
  cardId: string
  name: string | null
  stamps: number
  total: number
  minutesSinceLastStamp: number | null
  birthday: { gift: string | null; redeemed: boolean } | null // está de cumple (functions/src/birthday/rules.ts)
  // Avisos sobre el cliente (functions/src/scanner/insights.ts)
  insights: { kind: 'first' | 'back' | 'loyal' | 'almost' | 'anniversary'; text: string }[]
  since: number | null
  visits: number
  lastVisitDays: number | null
}

export const scannerLogin = callable<{ businessId: string; pin: string }, { token: string; business: ScannerBusiness }>('scannerLogin')
export const scannerSession = callable<{ businessId: string; token: string }, { business: ScannerBusiness }>('scannerSession')
export const scannerLookup = callable<{ businessId: string; token: string; code: string }, { cards: ScannedCard[] }>('scannerLookup')
export const scannerStamp = callable<
  { businessId: string; token: string; cardId: string; action: 'add' | 'redeem' | 'birthday'; force?: boolean },
  { card: ScannedCard }
>('scannerStamp')
export const setScannerPin = callable<{ businessId: string; pin: string }, { ok: boolean }>('setScannerPin')

const key = (businessId: string) => `sellito-scanner:${businessId}`

export function loadToken(businessId: string): string | null {
  try {
    return localStorage.getItem(key(businessId))
  } catch {
    return null
  }
}

export function saveToken(businessId: string, token: string | null) {
  try {
    if (token) localStorage.setItem(key(businessId), token)
    else localStorage.removeItem(key(businessId))
  } catch {
    // Sin almacenamiento (modo privado): la sesión dura mientras la página esté abierta.
  }
}

// Las Functions mandan el motivo en el mensaje ("wrong:3", "cooldown:2", "session"...).
export function scannerError(err: unknown): { code: string; reason: string; value: number | null } {
  if (!(err instanceof FirebaseError)) return { code: 'unknown', reason: '', value: null }
  const [reason, value] = err.message.split(':')
  return { code: err.code.replace('functions/', ''), reason, value: value ? Number(value) : null }
}

// Último escáner abierto en este celular: el acceso directo instalado abre /escaner y vuelve acá.
const LAST_BUSINESS_KEY = 'sellito-scanner:last'

export function rememberScannerBusiness(businessId: string) {
  try {
    localStorage.setItem(LAST_BUSINESS_KEY, businessId)
  } catch {
    // sin almacenamiento: el acceso directo pedirá el link de nuevo
  }
}

export function lastScannerBusiness(): string | null {
  try {
    return localStorage.getItem(LAST_BUSINESS_KEY)
  } catch {
    return null
  }
}
