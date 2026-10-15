import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { scannerError } from '../lib/scanner'
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
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const { user } = useAuth()
  const [payerEmail, setPayerEmail] = useState(sub?.payerEmail ?? user?.email ?? '')
  const returning = params.get('suscripcion') === 'ok' // volvió del checkout de Mercado Pago

  // Primero se confirma el mail de la cuenta de Mercado Pago que va a pagar.
  const pay = () => {
    setError(null)
    setAsking(true)
  }

  async function confirmPay(e: FormEvent) {
    e.preventDefault()
    const email = payerEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Ingresá un mail válido.')
    setBusy(true)
    setError(null)
    try {
      const r = await createSubscription({ businessId: business.id, payerEmail: email })
      window.location.assign(r.data.url)
    } catch (err) {
      const reason = scannerError(err).reason
      setError(
        reason === 'payer-test-mismatch'
          ? 'Mercado Pago no acepta ese mail con las credenciales actuales: en modo de prueba tiene que ser el de un comprador de prueba, y en producción el de una cuenta real.'
          : reason === 'payer-email'
            ? 'Ingresá un mail válido.'
            : 'No pudimos abrir el pago. Intentá de nuevo en un rato.',
      )
      setBusy(false)
    }
  }

  const price = plan ? `${formatMoney(plan.amount, plan.currency)} por mes` : null
  const button = (label: string, primary = true) => (
    <button className={primary ? 'btn btn-sm btn-primary' : 'btn btn-sm'} type="button" onClick={pay}>
      {label}
    </button>
  )
  const dialog = asking && (
    <div className="scrim" onClick={() => !busy && setAsking(false)}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && !busy && setAsking(false)}
        onSubmit={confirmPay}
        noValidate
      >
        <h3 id="pay-title">¿Con qué cuenta de Mercado Pago vas a pagar?</h3>
        <p style={{ margin: 0, color: 'var(--text-soft)' }}>
          Mercado Pago pide el mail de la cuenta que paga. Si es el mismo con el que entrás acá, dejalo como está.
          {price && ` La suscripción es de ${price}.`}
        </p>
        <div>
          <label className="label" htmlFor="payer-email">Mail de tu cuenta de Mercado Pago</label>
          <input
            id="payer-email"
            className="input"
            type="email"
            autoComplete="email"
            value={payerEmail}
            onChange={(e) => setPayerEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'payer-error' : undefined}
            autoFocus
          />
          {error && <p className="help help-error" id="payer-error" role="alert">{error}</p>}
        </div>
        <div className="dialog-actions">
          <button className="btn" type="button" onClick={() => setAsking(false)} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
            {busy && <Spinner small />}
            {busy ? 'Abriendo Mercado Pago…' : 'Ir a Mercado Pago'}
          </button>
        </div>
      </form>
    </div>
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
          {dialog}
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
          {dialog}
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
          {dialog}
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
          {dialog}
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
        {dialog}
      </div>
      {button('Suscribirme')}
    </div>
  )
}
