import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import mascot from '../assets/mascot.svg'
import { DEMO_ENROLL_CODE } from '../content/brand'
import type { CardConfig } from '../lib/cardDesign'
import { isIOS } from '../lib/install'
import { enrollUrl } from '../lib/urls'
import CardPreview from './CardPreview'
import WalletButton from './WalletButton'

// "Probala vos": la tarjeta de ejemplo de Sellito, que se agrega de verdad al Wallet.
const DEMO: CardConfig = {
  name: 'Sellito',
  logoUrl: mascot,
  bgColor: '#FF9EC4',
  stampIconId: 'estrella',
  stampsRequired: 6,
  rewardText: 'un abrazo de Sellito',
  itemSingular: 'sello',
  itemPlural: 'sellos',
  conditions: '',
  askFields: { name: true, phone: false, email: false },
  locations: [],
  proximityEnabled: false,
}

export default function DemoCard() {
  const url = enrollUrl(DEMO_ENROLL_CODE)
  const [qr, setQr] = useState<string | null>(null)
  const ios = isIOS()

  useEffect(() => {
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#12372A', light: '#FFFFFF' } }).then(setQr)
  }, [url])

  return (
    <section id="probala" className="section demo">
      <div className="demo-text">
        <p className="eyebrow">Probala ahora</p>
        <h2>Guardá la tarjeta de Sellito en tu celular</h2>
        <p className="section-lead" style={{ textAlign: 'left', margin: '12px 0 0' }}>
          Es una tarjeta de ejemplo, igual a la que van a tener tus clientes. Te regalamos el primer sello.
        </p>
        <div className="demo-mobile">
          <WalletButton platform={ios ? 'apple' : 'google'} href={url} />
        </div>
        {qr && (
          <div className="demo-qr">
            <img src={qr} alt={`Código QR para agregar la tarjeta de ejemplo (${url})`} width={180} height={180} />
            <p>Escaneá el código con la cámara de tu celular. No hace falta descargar nada.</p>
          </div>
        )}
      </div>
      <div className="demo-card" aria-hidden="true">
        <CardPreview config={DEMO} filled={1} platform={ios ? 'iphone' : 'android'} />
      </div>
    </section>
  )
}
