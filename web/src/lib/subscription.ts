import { useEffect, useState } from 'react'
import { callable } from './firebase'
import type { Subscription } from './types'
import { API_URL } from './urls'

// Misma lógica que functions/src/payments/access.ts (ver ahí qué significa cada nivel).
export type AccessLevel = 'none' | 'full' | 'grace' | 'blocked' | 'archived'

export function accessLevel(sub: Subscription | undefined, now = Date.now()): AccessLevel {
  const ms = (t: { toMillis(): number } | undefined) => t?.toMillis() ?? 0
  switch (sub?.status) {
    case undefined:
      return 'none'
    case 'active':
      return 'full'
    case 'trial':
      return ms(sub.trialEndsAt) > now ? 'full' : 'blocked'
    case 'past_due':
      return ms(sub.graceUntil) > now ? 'grace' : 'blocked'
    case 'archived':
      return 'archived'
    default:
      return 'blocked'
  }
}

// Modo lectura: se ven clientes y estadísticas, no se edita diseño, regla ni PIN.
export const isReadOnly = (level: AccessLevel) => level === 'blocked' || level === 'archived'
// Igual que canOperate en functions/src/payments/access.ts: escáner y avisos funcionan.
export const canOperate = (level: AccessLevel) => level === 'full' || level === 'grace'

export const createSubscription = callable<{ businessId: string; plan?: string; payerEmail?: string }, { url: string }>('createSubscription')

export type Plan = { name: string; amount: number; currency: string; frequency: number; frequencyType: 'days' | 'months'; active: boolean }

// Precio del plan mensual (config/plans) para la landing y el panel. Sale de GET API_URL/plan (cacheado
// en el CDN); el último precio visto queda en el navegador para mostrarlo al instante la próxima vez.
const PLAN_KEY = 'sellito-plan'

function cachedPlan(): Plan | null {
  try {
    return JSON.parse(localStorage.getItem(PLAN_KEY) ?? 'null') as Plan | null
  } catch {
    return null
  }
}

export function useMonthlyPlan(): Plan | null {
  const [plan, setPlan] = useState<Plan | null>(cachedPlan)
  useEffect(() => {
    fetch(`${API_URL}/plan`)
      .then((r) => (r.ok ? (r.json() as Promise<Plan>) : null))
      .then((p) => {
        if (!p?.active) return
        setPlan(p)
        try {
          localStorage.setItem(PLAN_KEY, JSON.stringify(p))
        } catch {
          // sin almacenamiento: no pasa nada
        }
      })
      .catch(() => undefined)
  }, [])
  return plan
}

export const formatMoney = (amount: number, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

export const formatDay = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
