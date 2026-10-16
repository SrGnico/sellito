import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import CardPreview, { type WalletPlatform } from '../components/CardPreview'
import { usePayDialog } from '../components/PayDialog'
import { cardConfigFrom, enrollMissing } from '../lib/cardDesign'
import { formatMoney, isDraft, useMonthlyPlan } from '../lib/subscription'
import type { Business } from '../lib/types'

// Vista previa antes de pagar: la tarjeta real del negocio (colores, logo, premio) dibujada como se ve
// en iPhone y en Android. No se crea ningún pase ni clase de Google Wallet hasta que active.
export default function Preview({ business }: { business: Business }) {
  const plan = useMonthlyPlan()
  const price = plan ? `${formatMoney(plan.amount, plan.currency)} por mes` : null
  const { open: pay, dialog } = usePayDialog(business, price)
  const config = cardConfigFrom(business)
  const filled = Math.min(2, config.stampsRequired)
  const missing = enrollMissing(business)
  const draft = isDraft(business)

  return (
    <div className="preview-page">
      <div>
        <h2>Así ven tu tarjeta tus clientes</h2>
        <p className="section-intro">Con tu logo, tus colores y tu premio, tal cual aparece en el celular.</p>
      </div>

      <div className="preview-phones">
        <Phone platform="iphone" label="iPhone · Apple Wallet">
          <CardPreview config={config} filled={filled} platform="iphone" />
        </Phone>
        <Phone platform="android" label="Android · Google Wallet">
          <CardPreview config={config} filled={filled} platform="android" />
        </Phone>
      </div>

      {!draft ? (
        <div className="preview-activate">
          <p className="alert-title" style={{ margin: 0 }}>Tu tarjeta ya está activa</p>
          <Link className="btn btn-primary" to="/panel/qr">Ver el QR del local</Link>
        </div>
      ) : missing.length > 0 ? (
        <div className="preview-activate">
          <p style={{ margin: 0 }}>Para activarla te falta {missing.join(' y ')}.</p>
          <Link className="btn btn-primary" to="/panel/configurar">Terminar mi tarjeta</Link>
        </div>
      ) : (
        <div className="preview-activate">
          <button className="btn btn-lg btn-primary" type="button" onClick={pay}>
            {plan ? `Activar mi tarjeta por ${formatMoney(plan.amount, plan.currency)}/mes` : 'Activar mi tarjeta'}
          </button>
          <p className="help" style={{ margin: 0 }}>Pagás solo cuando activás. Podés cancelar cuando quieras.</p>
          <Link className="help" to="/panel/tarjeta" style={{ margin: 0 }}>Quiero cambiar algo del diseño</Link>
          {dialog}
        </div>
      )}
    </div>
  )
}

function Phone({ platform, label, children }: { platform: WalletPlatform; label: string; children: ReactNode }) {
  return (
    <figure className="preview-phone">
      <div className={`preview-device preview-${platform}`} aria-hidden="true">
        <div className="preview-screen">
          <div className="preview-status">
            <span>9:41</span>
            <span className="preview-camera" />
            <span className="preview-status-icons">●●●</span>
          </div>
          <div className="preview-card">{children}</div>
        </div>
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  )
}
