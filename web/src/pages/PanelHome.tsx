import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BusinessStats from '../components/BusinessStats'
import CardPreview from '../components/CardPreview'
import { cardConfigFrom, enrollMissing } from '../lib/cardDesign'
import { db } from '../lib/firebase'
import { accessLevel, isDraft, isReadOnly, type AccessLevel } from '../lib/subscription'
import type { Business } from '../lib/types'

// Inicio del panel: un resumen del negocio. Lo detallado vive en cada sección (Tarjeta, QR, Escáner, Clientes).
export default function PanelHome({ business }: { business: Business }) {
  const level = accessLevel(business.subscription)
  const designed = enrollMissing(business).length === 0

  return (
    <>
      <div className="home-head">
        <div>
          <h2>{business.name}</h2>
          <StatusLine business={business} level={level} />
        </div>
      </div>

      {!designed && !isReadOnly(level) && (
        <section className="card card-pink setup" aria-labelledby="wizard-cta">
          <h4 id="wizard-cta">Armá tu tarjeta en 3 minutos</h4>
          <p style={{ margin: 0 }}>Te guiamos paso a paso: logo y color, premio y datos de tus clientes.</p>
          <Link className="btn btn-primary" to="configurar" style={{ alignSelf: 'flex-start' }}>Empezar</Link>
        </section>
      )}

      <SetupChecklist business={business} level={level} />

      {designed && <BusinessStats businessId={business.id} />}

      <div className="home-layout">
        <section className="card home-card-summary" aria-labelledby="home-card-title">
          <div className="home-section-head">
            <h4 id="home-card-title">Tu tarjeta</h4>
            <Link className="btn btn-sm" to="tarjeta">
              {isReadOnly(level) ? 'Ver' : designed ? 'Editar' : 'Diseñar'}
            </Link>
          </div>
          <div className="home-card-preview">
            <CardPreview config={cardConfigFrom(business)} filled={designed ? 2 : 0} />
          </div>
          {business.rule?.rewardText && (
            <p className="help" style={{ margin: 0 }}>
              {business.rule.stampsRequired} sellos = {business.rule.rewardText}
            </p>
          )}
        </section>

        <div className="home-side">
          <QuickLinks business={business} />
          {designed && <RecentActivity businessId={business.id} />}
        </div>
      </div>
    </>
  )
}

// ---------- Estado en una línea ----------

function StatusLine({ business, level }: { business: Business; level: AccessLevel }) {
  const sub =
    level === 'full'
      ? { cls: 'badge-ok', text: business.subscription?.status === 'trial' ? 'En prueba' : 'Suscripción activa' }
      : level === 'grace'
        ? { cls: 'badge-warn', text: 'Pago pendiente' }
        : level === 'blocked' || level === 'archived'
          ? { cls: 'badge-err', text: 'Suscripción vencida' }
          : { cls: 'badge-info', text: isDraft(business) ? 'Falta activar' : 'Sin suscripción' }
  const proximity = business.proximityEnabled && (business.locations?.length ?? 0) > 0
  return (
    <div className="status-line">
      <span className={`badge ${sub.cls}`}>{sub.text}</span>
      <span className={`badge ${(business.scannerPinVersion ?? 0) > 0 ? 'badge-ok' : 'badge-info'}`}>
        {(business.scannerPinVersion ?? 0) > 0 ? 'Escáner listo' : 'Escáner sin PIN'}
      </span>
      {proximity && <span className="badge badge-ok">Cercanía activada</span>}
    </div>
  )
}

// ---------- Primeros pasos ----------

type Step = { id: string; title: string; detail: string; done: boolean; to?: string; action?: string; optional?: boolean }

function SetupChecklist({ business, level }: { business: Business; level: AccessLevel }) {
  const [hasCards, setHasCards] = useState<boolean | null>(null)

  // Si ya hay clientes, el QR claramente está funcionando.
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'businesses', business.id, 'cards'), limit(1)), (snap) => setHasCards(!snap.empty), () =>
        setHasCards(false),
      ),
    [business.id],
  )

  const steps: Step[] = [
    { id: 'design', title: 'Diseñá tu tarjeta', detail: 'Logo, color y premio.', done: enrollMissing(business).length === 0, to: 'configurar', action: 'Diseñar' },
    {
      id: 'subscription',
      title: 'Activá tu tarjeta',
      detail: 'Mirala en el celular y activala. Así se habilitan el QR, el escáner y tu lista de clientes.',
      done: level === 'full' || level === 'grace',
      to: isDraft(business) ? 'vista-previa' : undefined,
      action: 'Ver y activar',
    },
    { id: 'pin', title: 'Creá el PIN del escáner', detail: 'Para sumar sellos desde el celular del local.', done: (business.scannerPinVersion ?? 0) > 0, to: 'escaner', action: 'Crear PIN' },
    { id: 'qr', title: 'Poné el QR en el mostrador', detail: 'Tus clientes lo escanean y guardan la tarjeta.', done: hasCards === true, to: 'qr', action: 'Ver QR' },
    {
      id: 'locations',
      title: 'Cargá tus locales',
      detail: 'La tarjeta puede aparecer cuando el cliente está cerca.',
      done: Boolean(business.proximityEnabled && business.locations?.length),
      to: 'tarjeta?paso=locales',
      action: 'Cargar',
      optional: true,
    },
    {
      id: 'birthday',
      title: 'Activá los regalos de cumpleaños',
      detail: 'Cada cliente recibe un saludo tuyo en su día, con un regalo si querés.',
      done: Boolean(business.birthday?.enabled),
      to: 'tarjeta?paso=clientes',
      action: 'Configurar',
      optional: true,
    },
  ]
  const required = steps.filter((s) => !s.optional)
  const doneCount = required.filter((s) => s.done).length
  if (hasCards === null || doneCount === required.length) return null

  return (
    <section className="card setup" aria-labelledby="setup-title">
      <div className="home-section-head">
        <h4 id="setup-title">Primeros pasos</h4>
        <span className="help" style={{ margin: 0 }}>
          {doneCount} de {required.length}
        </span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={required.length} aria-label="Progreso de los primeros pasos">
        <div className="progress-bar" style={{ width: `${(doneCount / required.length) * 100}%` }} />
      </div>
      <ol className="setup-list">
        {steps.map((s) => (
          <li key={s.id} className={s.done ? 'done' : undefined}>
            <span className="setup-check" aria-hidden="true">{s.done ? '✓' : ''}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>
                {s.title}
                {s.optional && <span className="help" style={{ display: 'inline', marginLeft: 6 }}>(opcional)</span>}
              </strong>
              <span className="setup-detail">{s.detail}</span>
            </div>
            <span className="sr-only">{s.done ? 'Hecho' : 'Pendiente'}</span>
            {!s.done && s.to && (
              <Link className="btn btn-sm" to={s.to}>
                {s.action}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

// ---------- Accesos rápidos ----------

function QuickLinks({ business }: { business: Business }) {
  // En borrador QR, escáner y clientes llevan a la vista previa (Panel.tsx); se muestra eso directo.
  if (isDraft(business)) {
    return (
      <nav className="quick-links" aria-label="Accesos rápidos">
        <Link to="vista-previa" className="quick-link">
          <strong>Vista previa</strong>
          <span>Mirá tu tarjeta en el celular y activala</span>
        </Link>
      </nav>
    )
  }
  const links = [
    { to: 'qr', title: 'QR del local', detail: 'Descargalo o imprimilo' },
    { to: 'escaner', title: 'Escáner', detail: (business.scannerPinVersion ?? 0) > 0 ? 'Abrilo en el celular del local' : 'Creá el PIN' },
    { to: 'clientes', title: 'Clientes', detail: 'Quiénes tienen tu tarjeta' },
    { to: 'avisos', title: 'Avisos', detail: 'Mandales una novedad al celular' },
    { to: 'tarjeta?paso=locales', title: 'Locales y cercanía', detail: business.proximityEnabled ? `${business.locations?.length ?? 0} cargados` : 'Apagado' },
  ]
  return (
    <nav className="quick-links" aria-label="Accesos rápidos">
      {links.map((l) => (
        <Link key={l.title} to={l.to} className="quick-link">
          <strong>{l.title}</strong>
          <span>{l.detail}</span>
        </Link>
      ))}
    </nav>
  )
}

// ---------- Actividad reciente ----------

type Activity = { id: string; type: string; at: Timestamp | null; stampsAfter?: number; name: string | null }

function timeAgo(date: Date): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'recién'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

function RecentActivity({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<Activity[] | null>(null)

  useEffect(() => {
    const names = new Map<string, string | null>()
    return onSnapshot(query(collection(db, 'businesses', businessId, 'stamps'), orderBy('at', 'desc'), limit(6)), async (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as { cardId: string; type: string; at: Timestamp | null; stampsAfter?: number }) }))
      // Nombre del cliente de cada movimiento (pocas lecturas: máximo 6 tarjetas distintas).
      await Promise.all(
        [...new Set(rows.map((r) => r.cardId))]
          .filter((id) => !names.has(id))
          .map(async (id) => {
            const card = await getDoc(doc(db, 'businesses', businessId, 'cards', id))
            names.set(id, (card.data()?.customer?.name as string | undefined) ?? null)
          }),
      )
      setItems(rows.map((r) => ({ id: r.id, type: r.type, at: r.at, stampsAfter: r.stampsAfter, name: names.get(r.cardId) ?? null })))
    }, () => setItems([]))
  }, [businessId])

  return (
    <section className="card" aria-labelledby="activity-title">
      <div className="home-section-head">
        <h4 id="activity-title">Actividad reciente</h4>
        <Link to="clientes" className="help" style={{ margin: 0 }}>Ver clientes</Link>
      </div>
      {items === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Cargando">
          {[0, 1, 2].map((i) => <span key={i} className="skeleton" style={{ height: 20 }} />)}
        </div>
      ) : items.length === 0 ? (
        <p className="help" style={{ margin: 0 }}>Todavía no hay sellos. Cuando el local sume el primero, aparece acá.</p>
      ) : (
        <ul className="activity">
          {items.map((it) => (
            <li key={it.id}>
              <span className={`activity-dot ${it.type === 'redeem' ? 'redeem' : ''}`} aria-hidden="true" />
              <span className="activity-text">
                <strong>{it.name ?? 'Cliente'}</strong>{' '}
                {it.type === 'redeem' ? 'canjeó su premio' : `sumó un sello${it.stampsAfter !== undefined ? ` (${it.stampsAfter})` : ''}`}
                {it.type === 'test' && ' · prueba'}
              </span>
              <span className="activity-time">{it.at ? timeAgo(it.at.toDate()) : 'recién'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
