import { collection, getAggregateFromServer, getCountFromServer, query, sum, Timestamp, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { NEW_DAYS } from '../lib/customers'
import { db } from '../lib/firebase'
import StatCard from './StatCard'

// Estadísticas del negocio (Inicio y Clientes): clientes, nuevos, sellos del mes y premios canjeados.
export default function BusinessStats({ businessId }: { businessId: string }) {

  const [stats, setStats] = useState<{ total: number; recent: number; monthStamps: number; redeemed: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [monthName] = useState(() => new Date().toLocaleDateString('es-AR', { month: 'long' }))

  useEffect(() => {
    const cards = collection(db, 'businesses', businessId, 'cards')
    const stamps = collection(db, 'businesses', businessId, 'stamps')
    const now = new Date()
    const monthStart = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1))
    const weekAgo = Timestamp.fromMillis(Date.now() - NEW_DAYS * 86400000)
    Promise.all([
      getCountFromServer(cards),
      getCountFromServer(query(cards, where('createdAt', '>=', weekAgo))),
      getCountFromServer(query(stamps, where('type', '==', 'add'), where('at', '>=', monthStart))),
      getAggregateFromServer(cards, { redeemed: sum('rewardsRedeemed') }),
    ])
      .then(([total, recent, month, agg]) =>
        setStats({
          total: total.data().count,
          recent: recent.data().count,
          monthStamps: month.data().count,
          redeemed: agg.data().redeemed ?? 0,
        }),
      )
      .catch(() => setFailed(true))
  }, [businessId])

  if (failed) {
    return (
      <p className="help help-error" role="alert">
        No pudimos cargar las estadísticas. Recargá la página para reintentar.
      </p>
    )
  }
  return (
    <div className="stats-grid">
      <StatCard label="Clientes" value={stats?.total ?? null} detail="Tarjetas en total" />
      <StatCard label="Nuevos" value={stats?.recent ?? null} detail={`Últimos ${NEW_DAYS} días`} />
      <StatCard label="Sellos sumados" value={stats?.monthStamps ?? null} detail={`En ${monthName}`} />
      <StatCard label="Premios canjeados" value={stats?.redeemed ?? null} detail="Desde el comienzo" pink />
    </div>
  )
}
