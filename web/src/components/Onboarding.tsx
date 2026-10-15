import { useState } from 'react'
import step1 from '../assets/onboarding-1-disena.svg'
import step2 from '../assets/onboarding-2-wallet.svg'
import step3 from '../assets/onboarding-3-escanea.svg'
import { APP_NAME } from '../lib/urls'

const STEPS = [
  { img: step1, title: 'Armá tu tarjeta', text: 'Elegí tu logo, tus colores y cuántos sellos hacen falta para el premio.' },
  { img: step2, title: 'Tus clientes la guardan', text: 'Escanean tu QR y la tarjeta queda en el Wallet del celular. Sin descargar ninguna app.' },
  { img: step3, title: 'Sumá sellos con la cámara', text: 'En cada compra escaneás la tarjeta y el sello aparece al instante.' },
]

// Onboarding del dueño (SELLITO_DESIGN_SYSTEM.md §9): puntos arriba, "Omitir" arriba a la derecha,
// "Atrás" desde el paso 2 y un solo botón principal abajo.
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  return (
    <section className="onboarding" aria-roledescription="presentación" aria-label={`Cómo funciona ${APP_NAME}`}>
      <div className="onboarding-top">
        <div className="onboarding-dots" aria-label={`Paso ${i + 1} de ${STEPS.length}`} role="img">
          {STEPS.map((_, n) => (
            <span key={n} className={n === i ? 'active' : undefined} />
          ))}
        </div>
        {!last && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={onDone}>
            Omitir
          </button>
        )}
      </div>

      <div key={i} className="fade-up">
        <div className="onboarding-art">
          <img src={step.img} alt="" width={320} height={240} />
        </div>
        <h2 style={{ marginTop: 24 }}>{step.title}</h2>
        <p style={{ color: 'var(--text-soft)', marginTop: 8 }}>{step.text}</p>
      </div>

      <div className="onboarding-actions">
        {i > 0 && (
          <button className="btn" type="button" onClick={() => setI(i - 1)}>
            Atrás
          </button>
        )}
        <button className="btn btn-primary" type="button" onClick={() => (last ? onDone() : setI(i + 1))} style={{ flex: 1 }}>
          {last ? 'Empezar' : 'Siguiente'}
        </button>
      </div>
    </section>
  )
}
