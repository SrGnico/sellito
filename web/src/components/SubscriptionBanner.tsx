import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { accessLevel, createSubscription, formatDay, formatMoney, useMonthlyPlan } from '../lib/subscription'
import type { Business } from '../lib/types'
import Spinner from './Spinner'

// Estado de la suscripción arriba del panel: activar, prueba, gracia (cobro fallido) o vencida.
export default function SubscriptionBanner({ business }: { business: Business }) {
  const sub = business.subscription
  const level = accessLevel(sub)
  const plan = useMonthlyPlan()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => Date.now())
  const [error, setError] = useState(false)
  const returning = params.get('suscripcion') === 'ok' // volvió del checkout de Mercado Pago

  async function pay() {
    setBusy(true)
    setError(false)
    try {
      const r = await createSubscription({ businessId: business.id })
      window.location.assign(r.data.url)
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  const price = plan ? `${formatMoney(plan.amount, plan.currency)} por mes` : null
  const button = (label: string, primary = true) => (
    <button className={primary ? 'btn btn-sm btn-primary' : 'btn btn-sm'} type="button" onClick={pay} disabled={busy} aria-busy={busy}>
      {busy && <Spinner small />}
      {busy ? 'Abriendo Mercado Pago…' : label}
    </button>
  )
  const errorText = error && (
    <span className="alert-text" role="alert" style={{ display: 'block', marginTop: 6, fontWeight: 600 }}>
      No pudimos abrir el pago. Intentá de nuevo en un rato.
    </span>
  )

  if (level === 'full' && sub?.status === 'active' && !sub.cancelAtPeriodEnd) return null

  if (returning && level !== 'full' && sub?.pendingPreapprovalId) {
    return (
      <div className="alert alert-info sub-banner" role="status">
        <div>
          <span className="alert-title">Estamos confirmando tu pago</span>
          <span className="alert-text">Mercado Pago puede tardar unos minutos. Esta página se actualiza sola.</span>
        </div>
      </div>
    )
  }

  if (level === 'grace') {
    return (
      <div className="alert alert-warn sub-banner" role="alert">
        <div>
          <span className="alert-title">No pudimos cobrar tu suscripción, actualizá tu medio de pago</span>
          <span className="alert-text">
            Todo sigue funcionando hasta el {formatDay(sub!.graceUntil!.toDate())}. Después se pausa el escáner del local.
          </span>
          {errorText}
        </div>
        {button('Actualizar medio de pago')}
      </div>
    )
  }

  if (level === 'blocked' || level === 'archived') {
    return (
      <div className="alert alert-err sub-banner" role="alert">
        <div>
          <span className="alert-title">Tu suscripción está vencida</span>
          <span className="alert-text">
            El escáner está en pausa y el panel quedó en modo lectura. No se perdió nada: tus clientes conservan sus tarjetas y
            sus sellos, y podés exportar tus contactos. Al reactivar, todo sigue como estaba.
            {price && ` ${price}.`}
          </span>
          {errorText}
        </div>
        {button('Reactivar suscripción')}
      </div>
    )
  }

  if (sub?.status === 'trial' && sub.trialEndsAt) {
    const days = Math.max(0, Math.ceil((sub.trialEndsAt.toMillis() - now) / 86400000))
    return (
      <div className="alert alert-info sub-banner" role="status">
        <div>
          <span className="alert-title">Te {days === 1 ? 'queda 1 día' : `quedan ${days} días`} de prueba gratis</span>
          <span className="alert-text">
            Suscribite antes del {formatDay(sub.trialEndsAt.toDate())} para que el escáner no se corte.{price && ` ${price}.`}
          </span>
          {errorText}
        </div>
        {button('Suscribirme')}
      </div>
    )
  }

  if (sub?.status === 'active' && sub.cancelAtPeriodEnd && sub.currentPeriodEnd) {
    return (
      <div className="alert alert-info sub-banner" role="status">
        <div>
          <span className="alert-title">Cancelaste tu suscripción</span>
          <span className="alert-text">Todo funciona hasta el {formatDay(sub.currentPeriodEnd.toDate())}.</span>
          {errorText}
        </div>
        {button('Volver a suscribirme', false)}
      </div>
    )
  }

  // Sin suscripción: puede diseñar, pero el escáner necesita la suscripción activa.
  if (!business.rule) return null
  return (
    <div className="alert alert-info sub-banner" role="status">
      <div>
        <span className="alert-title">Activá tu suscripción para usar el escáner</span>
        <span className="alert-text">
          Tu tarjeta y tu QR ya están listos. Con la suscripción, el local suma sellos desde el celular.{price && ` ${price}.`}
        </span>
        {errorText}
      </div>
      {button('Suscribirme')}
    </div>
  )
}
