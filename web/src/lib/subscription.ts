import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { callable, db } from './firebase'
import type { Subscription } from './types'

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

export const createSubscription = callable<{ businessId: string; plan?: string }, { url: string }>('createSubscription')

export type Plan = { name: string; amount: number; currency: string; frequency: number; frequencyType: 'days' | 'months'; active: boolean }

// Precio del plan mensual (config/plans) para mostrarlo en el panel.
export function useMonthlyPlan(): Plan | null {
  const [plan, setPlan] = useState<Plan | null>(null)
  useEffect(() => {
    getDoc(doc(db, 'config', 'plans'))
      .then((snap) => {
        const p = (snap.data()?.plans as Record<string, Plan> | undefined)?.monthly
        if (p?.active) setPlan(p)
      })
      .catch(() => setPlan(null))
  }, [])
  return plan
}

export const formatMoney = (amount: number, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

export const formatDay = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
