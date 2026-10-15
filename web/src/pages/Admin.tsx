import { signOut } from 'firebase/auth'
import { collection, getCountFromServer, getDocs, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import LoadingScreen from '../components/LoadingScreen'
import Mascot from '../components/Mascot'
import StatCard from '../components/StatCard'
import { useAuth } from '../lib/auth'
import { auth, db } from '../lib/firebase'
import { accessLevel, formatMoney, type AccessLevel } from '../lib/subscription'
import type { Business } from '../lib/types'
import { APP_NAME, enrollUrl } from '../lib/urls'
import '../styles/panel.css'

// Panel de super admin (SELLITO_SPEC.md §3.5): todos los negocios, estado de pago y métricas.
// Se entra con el custom claim `superadmin` (lo leen las reglas de Firestore; acá solo se usa para mostrar).

type Row = Business & { cards: number | null; level: AccessLevel }
type Filter = 'all' | 'full' | 'none' | 'grace' | 'blocked'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'full', label: 'Activos' },
  { id: 'none', label: 'Sin suscripción' },
  { id: 'grace', label: 'Pago pendiente' },
  { id: 'blocked', label: 'Vencidos' },
]

const LEVEL_BADGE: Record<AccessLevel, { cls: string; text: string }> = {
  full: { cls: 'badge-ok', text: 'Activo' },
  none: { cls: 'badge-info', text: 'Sin suscripción' },
  grace: { cls: 'badge-warn', text: 'Pago pendiente' },
  blocked: { cls: 'badge-err', text: 'Vencido' },
  archived: { cls: 'badge-err', text: 'Archivado' },
}

export default function Admin() {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  // Fuerza un token nuevo: el claim pudo haberse asignado después del último login.
  useEffect(() => {
    if (!user) return
    user
      .getIdTokenResult(true)
      .then((t) => setAllowed(t.claims.superadmin === true))
      .catch(() => setAllowed(false))
  }, [user])

  if (allowed === null) return <LoadingScreen label="Revisando permisos…" />
  if (!allowed) return <Navigate to="/panel" replace />
  return <AdminDashboard email={user?.email ?? ''} />
}

function AdminDashboard({ email }: { email: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [now] = useState(() => Date.now())

  useEffect(() => {
    getDocs(query(collection(db, 'businesses'), orderBy('createdAt', 'desc')))
      .then(async (snap) => {
        const list: Row[] = snap.docs.map((d) => {
          const b = { id: d.id, ...d.data() } as Business
          return { ...b, cards: null, level: accessLevel(b.subscription) }
        })
        setRows(list)
        // Cantidad de tarjetas de cada negocio (una consulta de conteo por negocio).
        const counts = await Promise.all(
          list.map((b) => getCountFromServer(collection(db, 'businesses', b.id, 'cards')).then((c) => c.data().count).catch(() => null)),
        )
        setRows(list.map((b, i) => ({ ...b, cards: counts[i] })))
      })
      .catch(() => setFailed(true))
  }, [])

  const metrics = useMemo(() => {
    if (!rows) return null
    const active = rows.filter((r) => r.level === 'full' && r.subscription?.status === 'active')
    const monthAgo = now - 30 * 86400000
    return {
      total: rows.length,
      active: active.length,
      mrr: active.reduce((sum, r) => sum + (r.subscription?.amount ?? 0), 0),
      newMonth: rows.filter((r) => (r.createdAt?.toMillis() ?? 0) >= monthAgo).length,
      cards: rows.every((r) => r.cards !== null) ? rows.reduce((sum, r) => sum + (r.cards ?? 0), 0) : null,
    }
  }, [rows, now])

  const visible = (rows ?? []).filter((r) => {
    const byFilter = filter === 'all' || r.level === filter || (filter === 'blocked' && r.level === 'archived')
    const q = search.trim().toLowerCase()
    return byFilter && (!q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
  })

  return (
    <>
      <header className="admin-header">
        <Link to="/panel" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <Mascot size={32} />
          <h4>{APP_NAME} · Admin</h4>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span className="help" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
          <button className="btn btn-sm" type="button" onClick={() => signOut(auth)}>Salir</button>
        </div>
      </header>

      <main className="main-wide">
        <h2>Negocios</h2>
        {failed ? (
          <EmptyState illustration="offline" title="No pudimos cargar los negocios"
            action={<button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>Reintentar</button>}>
            Revisá la conexión o los permisos de la cuenta.
          </EmptyState>
        ) : (
          <>
            <div className="stats-grid">
              <StatCard label="Negocios" value={metrics?.total ?? null} detail={metrics ? `${metrics.newMonth} nuevos en 30 días` : undefined} />
              <StatCard label="Suscripciones activas" value={metrics?.active ?? null} detail="Pagando hoy" />
              <StatCard label="Tarjetas emitidas" value={metrics?.cards ?? null} detail="En todos los negocios" />
              <div className="card card-pink stat-card">
                <span className="stat-label">Ingreso mensual</span>
                {metrics ? <span className="stat-value" style={{ fontSize: 'var(--text-3xl)' }}>{formatMoney(metrics.mrr)}</span>
                  : <span className="skeleton" style={{ width: 120, height: 40 }} aria-label="Cargando" />}
                <span className="stat-detail">Suma de suscripciones activas</span>
              </div>
            </div>

            <div className="customers-toolbar" style={{ marginTop: 24 }}>
              <div style={{ flex: '1 1 240px' }}>
                <label className="label" htmlFor="admin-search">Buscar</label>
                <input id="admin-search" className="input" placeholder="Nombre o ID" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="filter-chips" role="group" aria-label="Filtrar por estado">
              {FILTERS.map((f) => (
                <button key={f.id} className="chip" type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>

            {rows === null ? (
              <div className="table-wrap" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Cargando">
                {[0, 1, 2, 3].map((i) => <span key={i} className="skeleton" style={{ height: 22 }} />)}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState illustration="search" title="No hay negocios con ese filtro">Probá con otro filtro o búsqueda.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Negocio</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Plan</th>
                      <th scope="col">Tarjetas</th>
                      <th scope="col">Escáner</th>
                      <th scope="col">Alta</th>
                      <th scope="col"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id}>
                        <td className="cell-ellipsis"><strong>{r.name}</strong><div className="help" style={{ margin: 0 }}>{r.id}</div></td>
                        <td><span className={`badge badge-sm ${LEVEL_BADGE[r.level].cls}`} style={{ marginLeft: 0 }}>{LEVEL_BADGE[r.level].text}</span></td>
                        <td>{r.subscription?.amount ? formatMoney(r.subscription.amount, r.subscription.currency) : '—'}</td>
                        <td>{r.cards ?? '…'}</td>
                        <td>{(r.scannerPinVersion ?? 0) > 0 ? 'Con PIN' : 'Sin PIN'}</td>
                        <td>{r.createdAt ? r.createdAt.toDate().toLocaleDateString('es-AR') : '—'}</td>
                        <td>
                          {r.enrollCode && (
                            <a href={enrollUrl(r.enrollCode)} target="_blank" rel="noreferrer">Ver alta</a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
