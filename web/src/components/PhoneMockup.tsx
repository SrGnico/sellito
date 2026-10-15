import type { Example } from '../content/examples'
import CardPreview from './CardPreview'

// Celular de muestra para la landing: la tarjeta en Apple Wallet y un aviso que entra desde arriba,
// como llega en la pantalla del cliente. Todo decorativo (aria-hidden en quien lo usa).
export default function PhoneMockup({ example }: { example: Example }) {
  return (
    <div className="phone">
      <div className="phone-screen">
        <div className="phone-status">
          <span>9:41</span>
          <span className="phone-island" />
          <span className="phone-status-icons">●●●</span>
        </div>
        <div key={example.name} className="phone-notice">
          <img src={example.logoUrl} alt="" width={36} height={36} />
          <div>
            <div className="phone-notice-top">
              <strong>{example.name}</strong>
              <span>ahora</span>
            </div>
            <p>{example.notice}</p>
          </div>
        </div>
        <div key={`card-${example.name}`} className="phone-card card-swap-in">
          <CardPreview config={example} filled={example.filled} platform="iphone" />
        </div>
      </div>
    </div>
  )
}
