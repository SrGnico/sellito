import { collection, documentId, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'

// Embudo de los últimos 30 días (functions/src/analytics): visitas → demo → cuenta → negocio →
// asistente → suscripción. Solo totales por día; nada personal.
const STEPS: [string, string][] = [
  ['landing_view', 'Visitas a la landing'],
  ['demo_view', 'Abrieron la tarjeta de prueba'],
  ['demo_add', 'Agregaron la de prueba al Wallet'],
  ['cta_click', 'Tocaron "Crear mi tarjeta"'],
  ['signup', 'Crearon la cuenta'],
  ['business_created', 'Crearon el negocio'],
  ['wizard_done', 'Terminaron el asistente'],
  ['subscribe_click', 'Tocaron "Suscribirme"'],
]

type Day = { events?: Record<string, number>; sources?: Record<string, number> }

export default function Funnel() {
  const [totals, setTotals] = useState<{ events: Record<string, number>; sources: [string, number][]; enroll: [number, number] } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getDocs(query(collection(db, 'analytics'), orderBy(documentId(), 'desc'), limit(30)))
      .then((snap) => {
        const events: Record<string, number> = {}
        const sources: Record<string, number> = {}
        for (const d of snap.docs) {
          const day = d.data() as Day
          for (const [k, v] of Object.entries(day.events ?? {})) events[k] = (events[k] ?? 0) + v
          for (const [k, v] of Object.entries(day.sources ?? {})) sources[k] = (sources[k] ?? 0) + v
        }
        setTotals({
          events,
          sources: Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 6),
          enroll: [events.enroll_view ?? 0, events.enroll_add ?? 0],
        })
      })
      .catch(() => setFailed(true))
  }, [])

  if (failed) return null
  const top = Math.max(1, totals?.events.landing_view ?? 0)

  return (
    <section className="card" style={{ marginTop: 24, gap: 14 }} aria-labelledby="funnel-title">
      <h4 id="funnel-title">Embudo · últimos 30 días</h4>
      {!totals ? (
        <span className="skeleton" style={{ height: 120 }} />
      ) : (
        <>
          <ol className="funnel">
            {STEPS.map(([key, label]) => {
              const n = totals.events[key] ?? 0
              return (
                <li key={key}>
                  <span className="funnel-label">{label}</span>
                  <span className="funnel-bar"><span style={{ width: `${Math.max(2, (n / top) * 100)}%` }} /></span>
                  <strong>{n}</strong>
                </li>
              )
            })}
          </ol>
          <p className="help" style={{ margin: 0 }}>
            Clientes de los negocios: {totals.enroll[0]} abrieron una página de alta y {totals.enroll[1]} agregaron la tarjeta.
            {totals.sources.length > 0 && ` · De dónde llegan: ${totals.sources.map(([s, n]) => `${s} (${n})`).join(', ')}.`}
          </p>
        </>
      )}
    </section>
  )
}
