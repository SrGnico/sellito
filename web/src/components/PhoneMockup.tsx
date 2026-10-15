import { useLayoutEffect, useRef, useState } from 'react'
import type { Example } from '../content/examples'
import CardPreview from './CardPreview'

// Celular de muestra para la landing: la tarjeta en Apple Wallet y un aviso que entra desde arriba,
// como llega en la pantalla del cliente. Todo decorativo (aria-hidden en quien lo usa).
// Se dibuja siempre a 320 × 651 px y se escala entero (como una imagen), así el aviso y la tarjeta
// mantienen sus proporciones en cualquier pantalla. `maxHeight` limita el alto (encabezado de la landing).
const W = 320
const H = 651

export default function PhoneMockup({ example, maxHeight }: { example: Example; maxHeight?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = box.current?.parentElement
    if (!el) return
    const fit = () => setScale(Math.min(1, el.clientWidth / W, maxHeight ? maxHeight / H : 1))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxHeight])

  return (
    <div ref={box} className="phone-fit" style={{ width: W * scale, height: H * scale }}>
      <div className="phone" style={{ transform: `scale(${scale})` }}>
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
    </div>
  )
}
