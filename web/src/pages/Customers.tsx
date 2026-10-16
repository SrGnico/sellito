import { customerInsights, visitSummary } from '../lib/insights'
import { formatBirthday } from '../lib/birthday'
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import QRCode from 'qrcode'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import BusinessStats from '../components/BusinessStats'
import { OWNER_DATA_NOTICE } from '../content/privacy'
import {
  CARDS_VERSION,
  downloadCsv,
  exportCustomers,
  fetchCustomers,
  FILTERS,
  fixedSort,
  formatDate,
  formatDateTime,
  searchWords,
  upgradeCards,
  whatsappNumber,
  type CustomerFilter,
  type Sort,
  type SortKey,
} from '../lib/customers'
import { db } from '../lib/firebase'
import type { Business, Card, StampEvent } from '../lib/types'
import { enrollUrl } from '../lib/urls'

export default function Customers({ business }: { business: Business }) {
  // Las tarjetas viejas no tienen los campos de búsqueda: se completan una vez antes de listar.
  const [upgraded, setUpgraded] = useState(business.cardsVersion === CARDS_VERSION)
  useEffect(() => {
    if (upgraded) return
    upgradeCards({ businessId: business.id })
      .catch(() => undefined) // si falla, la lista igual carga (la búsqueda puede no encontrar las viejas)
      .finally(() => setUpgraded(true))
  }, [upgraded, business.id])

  return (
    <>
      <Link to="/panel">← Volver al panel</Link>
      <h2 style={{ marginTop: 16 }}>Clientes</h2>
      <BusinessStats businessId={business.id} />
      <div className="alert alert-info" role="note" style={{ marginTop: 24 }}>
        <div>
          <span className="alert-title">{OWNER_DATA_NOTICE.title}</span>
          <span className="alert-text">{OWNER_DATA_NOTICE.text}</span>
        </div>
      </div>
      {upgraded ? <CustomerList business={business} /> : <TableSkeleton />}
    </>
  )
}

// ---------- Lista ----------

// `key` dice para qué consulta es el resultado: si no coincide con la actual, está cargando.
type ListState =
  | { key: string; status: 'error' }
  | { key: string; status: 'ready'; cards: Card[]; hasMore: boolean; last: QueryDocumentSnapshot | null }

const SORT_LABELS: Record<SortKey, string> = { createdAt: 'Alta', lastActivityAt: 'Último sello', stamps: 'Sellos', birthdayMD: 'Cumpleaños' }

function CustomerList({ business }: { business: Business }) {
  const ask = business.askFields ?? { name: true, phone: true, email: false }
  const total = business.rule?.stampsRequired ?? 0
  const [filter, setFilter] = useState<CustomerFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>({ key: 'createdAt', dir: 'desc' })
  // Cursores de las páginas anteriores (Firestore pagina hacia adelante con startAfter).
  const [cursors, setCursors] = useState<(QueryDocumentSnapshot | null)[]>([null])
  const [result, setResult] = useState<ListState | null>(null)
  const [reloads, setReloads] = useState(0)
  const [selected, setSelected] = useState<Card | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  const page = cursors.length - 1
  const searching = searchWords(search).length > 0
  const lockedSort = fixedSort(filter, searching)
  const activeSort = lockedSort ?? sort

  // La búsqueda espera a que se deje de tipear.
  useEffect(() => {
    if (searchInput === search) return
    const t = setTimeout(() => {
      setSearch(searchInput)
      setCursors([null])
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput, search])

  const queryKey = JSON.stringify([filter, search, sort, page, reloads])
  const state: ListState | { status: 'loading' } = result?.key === queryKey ? result : { status: 'loading' }

  useEffect(() => {
    let cancelled = false
    fetchCustomers(business.id, { filter, search, sort, after: cursors[page] })
      .then((r) => !cancelled && setResult({ key: queryKey, status: 'ready', ...r }))
      .catch(() => !cancelled && setResult({ key: queryKey, status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [business.id, filter, search, sort, cursors, page, queryKey])

  function changeFilter(f: CustomerFilter) {
    setFilter(f)
    setSearchInput('')
    setSearch('')
    setCursors([null])
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
    setCursors([null])
  }

  async function handleExport() {
    setExporting(true)
    setExportError(false)
    try {
      const r = await exportCustomers({ businessId: business.id, filter: searching ? 'all' : filter, search })
      downloadCsv(r.data.filename, r.data.csv)
    } catch {
      setExportError(true)
    } finally {
      setExporting(false)
    }
  }

  const noFilters = filter === 'all' && !searching && page === 0
  const sortHeader = (key: SortKey) => {
    const active = activeSort.key === key
    return (
      <th aria-sort={active ? (activeSort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
        <button className="th-sort" type="button" onClick={() => toggleSort(key)} disabled={lockedSort !== null}>
          {SORT_LABELS[key]}
          <span aria-hidden="true">{active ? (activeSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
        </button>
      </th>
    )
  }

  return (
    <section style={{ marginTop: 24 }} aria-labelledby="customers-title">
      <h3 id="customers-title" className="sr-only">Lista de clientes</h3>
      <div className="customers-toolbar">
        <div style={{ flex: '1 1 240px' }}>
          <label className="label" htmlFor="customers-search">Buscar</label>
          <input
            id="customers-search"
            className="input"
            type="search"
            placeholder={['nombre', ask.phone && 'teléfono', ask.email && 'mail'].filter(Boolean).join(', ')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <button className="btn" type="button" onClick={handleExport} disabled={exporting} aria-busy={exporting}>
            {exporting && <Spinner small />}
            {exporting ? 'Exportando…' : 'Exportar contactos (CSV)'}
          </button>
          {exportError && (
            <span className="help help-error" role="alert" style={{ margin: 0 }}>
              No pudimos exportar. Intentá de nuevo.
            </span>
          )}
        </div>
      </div>

      <div className="filter-chips" role="group" aria-label="Filtros">
        {FILTERS.filter((f) => f.id !== 'birthday' || ask.birthday).map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={!searching && filter === f.id} onClick={() => changeFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {searching && filter !== 'all' && <p className="help">Mientras buscás, se busca entre todos los clientes.</p>}

      {state.status === 'loading' && <TableSkeleton />}

      {state.status === 'error' && (
        <EmptyState
          illustration="offline"
          title="No pudimos cargar tus clientes"
          action={<button className="btn btn-primary" type="button" onClick={() => setReloads((n) => n + 1)}>Reintentar</button>}
        >
          Revisá tu conexión a internet y volvé a probar.
        </EmptyState>
      )}

      {state.status === 'ready' && state.cards.length === 0 && noFilters && <NoCustomers business={business} />}

      {state.status === 'ready' && state.cards.length === 0 && !noFilters && (
        <EmptyState
          illustration="search"
          title="No encontramos clientes"
          action={<button className="btn" type="button" onClick={() => changeFilter('all')}>Ver todos</button>}
        >
          Probá con otra búsqueda u otro filtro.
        </EmptyState>
      )}

      {state.status === 'ready' && state.cards.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {ask.name && <th>Nombre</th>}
                  {ask.phone && <th>Teléfono</th>}
                  {ask.email && <th>Mail</th>}
                  {ask.birthday && <th>Cumpleaños</th>}
                  {sortHeader('stamps')}
                  <th>Premios canjeados</th>
                  {sortHeader('createdAt')}
                  {sortHeader('lastActivityAt')}
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {state.cards.map((c) => (
                  <tr key={c.id} className="row-link" onClick={() => setSelected(c)}>
                    {ask.name && (
                      <td>
                        <button className="link-button" type="button" onClick={(e) => { e.stopPropagation(); setSelected(c) }}>
                          {c.customer.name || 'Sin nombre'}
                        </button>
                      </td>
                    )}
                    {ask.phone && <td>{c.customer.phone ?? '—'}</td>}
                    {ask.email && <td className="cell-ellipsis">{c.customer.email ?? '—'}</td>}
                    {ask.birthday && <td>{formatBirthday(c.customer.birthday) || '—'}</td>}
                    <td>
                      {Math.min(c.stamps, total)}/{total}
                      {c.rewardsAvailable > 0 && <span className="badge badge-ok badge-sm">Premio</span>}
                    </td>
                    <td>{c.rewardsRedeemed}</td>
                    <td>{formatDate(c.createdAt)}</td>
                    <td>{formatDate(c.lastStampAt)}</td>
                    <td>
                      <ContactActions card={c} compact />
                      {!ask.name && (
                        <button className="btn btn-ghost btn-sm" type="button" onClick={(e) => { e.stopPropagation(); setSelected(c) }}>
                          Ver
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination" aria-label="Páginas">
            <button className="btn btn-sm" type="button" disabled={page === 0} onClick={() => setCursors(cursors.slice(0, -1))}>
              ← Anterior
            </button>
            <span>Página {page + 1}</span>
            <button
              className="btn btn-sm"
              type="button"
              disabled={!state.hasMore}
              onClick={() => setCursors([...cursors, state.last])}
            >
              Siguiente →
            </button>
          </nav>
        </>
      )}

      {selected && <CustomerDetail business={business} card={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}

function TableSkeleton() {
  return (
    <div className="table-wrap" role="status" aria-label="Cargando clientes" style={{ marginTop: 16 }}>
      <table className="table">
        <tbody>
          {Array.from({ length: 6 }, (_, i) => (
            <tr key={i}>
              {[140, 110, 60, 80, 80].map((w, j) => (
                <td key={j}>
                  <span className="skeleton" style={{ display: 'block', width: w, height: 16 }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NoCustomers({ business }: { business: Business }) {
  async function downloadQr() {
    if (!business.enrollCode) return
    const png = await QRCode.toDataURL(enrollUrl(business.enrollCode), {
      width: 1200,
      margin: 2,
      color: { dark: '#12372A', light: '#FFFFFF' },
    })
    const a = document.createElement('a')
    a.href = png
    a.download = 'qr-tarjeta.png'
    a.click()
  }
  return (
    <EmptyState
      illustration="clients"
      title="Todavía no tenés clientes"
      action={
        business.enrollCode ? (
          <button className="btn btn-primary" type="button" onClick={downloadQr}>Descargar mi QR</button>
        ) : (
          <Link className="btn btn-primary" to="/panel">Descargar mi QR</Link>
        )
      }
    >
      Imprimí tu QR y ponelo en el mostrador: tus clientes lo escanean y se suman en segundos.
    </EmptyState>
  )
}

// ---------- Acciones de contacto ----------

function ContactActions({ card, compact = false }: { card: Card; compact?: boolean }) {
  const wa = whatsappNumber(card.customer.phone)
  const name = card.customer.name ?? 'cliente'
  if (!wa && !card.customer.email) return null
  const stop = (e: MouseEvent) => e.stopPropagation()
  return (
    <span className="contact-actions">
      {wa && (
        <a className="btn btn-sm" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" onClick={stop} aria-label={`WhatsApp a ${name}`}>
          WhatsApp
        </a>
      )}
      {card.customer.email && (
        <a className="btn btn-sm" href={`mailto:${card.customer.email}`} onClick={stop} aria-label={`Mail a ${name}`}>
          {compact ? 'Mail' : 'Mandar mail'}
        </a>
      )}
    </span>
  )
}

// ---------- Detalle ----------

const EVENT_LABELS: Record<StampEvent['type'], string> = { add: '+1 sello', redeem: 'Premio canjeado', test: 'Prueba' }

function CustomerDetail({ business, card, onClose }: { business: Business; card: Card; onClose: () => void }) {
  const total = business.rule?.stampsRequired ?? 0
  const [events, setEvents] = useState<StampEvent[] | 'loading' | 'error'>('loading')
  const [facts] = useState(() => ({ insights: customerInsights(card, total, business.birthday), summary: visitSummary(card, total) }))
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const q = query(
      collection(db, 'businesses', business.id, 'stamps'),
      where('cardId', '==', card.id),
      orderBy('at', 'desc'),
      limit(50),
    )
    getDocs(q)
      .then((snap) => setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StampEvent)))
      .catch(() => setEvents('error'))
  }, [business.id, card.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog customer-detail" role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="detail-title">{card.customer.name || 'Cliente'}</h3>
        <p className="help client-facts">{facts.summary}</p>
        {facts.insights.length > 0 && (
          <ul className="client-insights">
            {facts.insights.map((i) => (
              <li key={i.kind} className={`insight-${i.kind}`}>{i.text}</li>
            ))}
          </ul>
        )}
        <dl className="detail-list">
          {card.customer.phone && (<><dt>Teléfono</dt><dd>{card.customer.phone}</dd></>)}
          {card.customer.email && (<><dt>Mail</dt><dd style={{ overflowWrap: 'anywhere' }}>{card.customer.email}</dd></>)}
          {card.customer.birthday && (<><dt>Cumpleaños</dt><dd>{formatBirthday(card.customer.birthday)}</dd></>)}
          <dt>Sellos</dt>
          <dd>{Math.min(card.stamps, total)} de {total}{card.rewardsAvailable > 0 && ' · premio disponible'}</dd>
          <dt>Premios canjeados</dt>
          <dd>{card.rewardsRedeemed}</dd>
          <dt>Alta</dt>
          <dd>{formatDate(card.createdAt)}</dd>
          <dt>Último sello</dt>
          <dd>{formatDate(card.lastStampAt)}</dd>
          {card.codeSuffix && (<><dt>Código</dt><dd>{card.codeSuffix}</dd></>)}
          <dt>Novedades</dt>
          <dd>{card.consent ? (card.consent.marketing ? 'Aceptó recibirlas' : 'No aceptó') : 'Sin dato'}</dd>
        </dl>
        <ContactActions card={card} />

        <h4 style={{ marginTop: 8 }}>Historial</h4>
        {events === 'loading' && <p role="status" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}><Spinner small /> Cargando…</p>}
        {events === 'error' && <p className="help help-error" role="alert" style={{ margin: 0 }}>No pudimos cargar el historial.</p>}
        {Array.isArray(events) && events.length === 0 && <p style={{ margin: 0, color: 'var(--text-soft)' }}>Todavía no sumó sellos.</p>}
        {Array.isArray(events) && events.length > 0 && (
          <ul className="history">
            {events.map((ev) => (
              <li key={ev.id}>
                <span>{EVENT_LABELS[ev.type] ?? ev.type}{ev.type === 'add' && ` (${ev.stampsAfter} de ${total})`}</span>
                <span className="history-date">{formatDateTime(ev.at)}</span>
              </li>
            ))}
          </ul>
        )}
        {Array.isArray(events) && events.length === 50 && <p className="help" style={{ margin: 0 }}>Se muestran los últimos 50.</p>}

        <div className="dialog-actions">
          <button ref={closeRef} className="btn" type="button" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

