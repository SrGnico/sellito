import type { BirthdayConfig, Card } from './types'

// Lo importante de un cliente, para su ficha en Clientes. Mismos criterios que el escáner
// (functions/src/scanner/insights.ts), con el texto pensado para verlo desde el panel.
export type PanelInsight = { kind: 'away' | 'loyal' | 'almost' | 'reward' | 'birthday' | 'anniversary' | 'new'; text: string }

const DAY = 86_400_000
const AWAY_DAYS = 30
const LOYAL_REWARDS = 2

export function customerInsights(card: Card, total: number, birthday: BirthdayConfig | undefined, now = Date.now()): PanelInsight[] {
  const stamps = Math.min(card.stamps, total)
  const created = card.createdAt?.toMillis() ?? null
  const last = card.lastActivityAt?.toMillis() ?? card.lastStampAt?.toMillis() ?? created
  const days = last !== null ? Math.floor((now - last) / DAY) : null
  const visits = card.rewardsRedeemed * total + stamps
  const out: PanelInsight[] = []

  if (card.rewardsAvailable > 0) out.push({ kind: 'reward', text: 'Tiene el premio listo para canjear.' })
  else if (stamps === total - 1) out.push({ kind: 'almost', text: 'Le falta un sello para el premio.' })

  if (visits === 0 && created !== null && now - created < 7 * DAY) out.push({ kind: 'new', text: 'Se sumó esta semana y todavía no vino a sumar sellos.' })
  else if (days !== null && days >= AWAY_DAYS) {
    const when = days >= 60 ? `${Math.floor(days / 30)} meses` : `${days} días`
    out.push({ kind: 'away', text: `Hace ${when} que no viene. Un aviso o un mimo puede traerlo de vuelta.` })
  }

  if (card.rewardsRedeemed >= LOYAL_REWARDS) out.push({ kind: 'loyal', text: `Cliente fiel: ya canjeó ${card.rewardsRedeemed} premios.` })

  const md = card.customer.birthday?.slice(5)
  if (md && birthday?.enabled) {
    const thisMonth = new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(5, 7)
    if (md.slice(0, 2) === thisMonth) out.push({ kind: 'birthday', text: `Cumple este mes (el ${Number(md.slice(3))}).` })
  }

  if (created !== null) {
    const years = Math.floor((now - created) / (365.25 * DAY))
    if (years >= 1) out.push({ kind: 'anniversary', text: `Tiene tu tarjeta hace ${years} ${years === 1 ? 'año' : 'años'}.` })
  }
  return out
}

// "31 visitas · última hace 3 días"
export function visitSummary(card: Card, total: number, now = Date.now()): string {
  const visits = card.rewardsRedeemed * total + Math.min(card.stamps, total)
  const last = card.lastStampAt?.toMillis()
  const days = last ? Math.floor((now - last) / DAY) : null
  const parts = [`${visits} ${visits === 1 ? 'visita' : 'visitas'}`]
  if (days !== null) parts.push(days === 0 ? 'última hoy' : days === 1 ? 'última ayer' : `última hace ${days} días`)
  return parts.join(' · ')
}
