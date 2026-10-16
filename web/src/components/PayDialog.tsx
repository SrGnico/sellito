import { pixelEvent } from '../lib/metaPixel'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { scannerError } from '../lib/scanner'
import { createSubscription, useMonthlyPlan } from '../lib/subscription'
import { track } from '../lib/track'
import type { Business } from '../lib/types'
import Spinner from './Spinner'

// Pagar, activar o reactivar: primero se confirma el mail de la cuenta de Mercado Pago que va a pagar
// y después se abre el checkout de la suscripción. Lo usan el aviso del panel y la vista previa.
export function usePayDialog(business: Business, price: string | null) {
  const { user } = useAuth()
  const plan = useMonthlyPlan()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payerEmail, setPayerEmail] = useState(business.subscription?.payerEmail ?? user?.email ?? '')

  const open = () => {
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
      track('subscribe_click')
      pixelEvent('InitiateCheckout', plan ? { value: plan.amount, currency: plan.currency } : {})
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

  return { open, dialog }
}
