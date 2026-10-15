import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { RESPONSIBLE } from '../content/legal'
import { APP_NAME, APP_URL } from '../lib/urls'
import '../styles/landing.css'

// /soporte: ayuda para quienes tienen una tarjeta y para los negocios (Google Wallet la pide para publicar).
const CUSTOMER_FAQ: [string, string][] = [
  [
    '¿Cómo agrego la tarjeta a mi celular?',
    'Escaneá el QR del local con la cámara, completá tus datos y tocá “Agregar”. En iPhone se guarda en Apple Wallet y en Android en Google Wallet. No hace falta descargar ninguna app.',
  ],
  [
    'Cambié de celular o borré la tarjeta, ¿pierdo mis sellos?',
    'No. Volvé a escanear el QR del local con el mismo teléfono o mail que usaste la primera vez y recuperás tu tarjeta con tus sellos.',
  ],
  [
    'Me sumaron un sello pero no lo veo',
    'La tarjeta se actualiza sola en unos segundos. Si no cambia, abrila y cerrala, o revisá que el celular tenga internet. Si sigue igual, avisale al local: ellos ven tus sellos en su panel.',
  ],
  [
    '¿Cómo saco la tarjeta del celular?',
    'En Apple Wallet: abrí la tarjeta, tocá “…” y “Eliminar pase”. En Google Wallet: abrí la tarjeta, tocá “⋮” y “Quitar”.',
  ],
  [
    '¿Cómo pido que borren mis datos?',
    `Pedíselo al local, que es el responsable de su lista de clientes, o escribinos a ${RESPONSIBLE.email} con el nombre del local y el teléfono o mail que usaste. Te respondemos y los borramos.`,
  ],
  [
    'No quiero recibir más avisos de un local',
    'Podés pedírselo al local o escribirnos. También podés desactivar las notificaciones de esa tarjeta desde la configuración de la tarjeta en tu Wallet.',
  ],
]

const BUSINESS_FAQ: [string, string][] = [
  ['¿Cómo empiezo?', `Creá tu cuenta en ${APP_URL.replace(/^https?:\/\//, '')}, diseñá tu tarjeta e imprimí el QR. Diseñar es gratis.`],
  ['El escáner no me deja entrar', 'Revisá el PIN en el panel (sección Escáner). Después de 5 intentos fallidos se bloquea 15 minutos. Si la suscripción está vencida, el escáner queda en pausa hasta reactivarla.'],
  ['¿Cómo cancelo la suscripción?', 'Desde tu cuenta de Mercado Pago, en Suscripciones. Seguís usando el servicio hasta el final del período pagado y tu lista de clientes no se borra.'],
]

export default function Support() {
  useEffect(() => {
    document.title = `Soporte · ${APP_NAME}`
  }, [])

  return (
    <div className="site">
      <SiteHeader />
      <main className="legal">
        <h1>Soporte</h1>
        <p className="legal-updated">¿Necesitás ayuda? Estamos para darte una mano.</p>

        <div className="card support-contact">
          <h2 style={{ marginTop: 0 }}>Escribinos</h2>
          <p style={{ margin: 0 }}>
            <a className="btn btn-primary" href={`mailto:${RESPONSIBLE.email}`}>{RESPONSIBLE.email}</a>
          </p>
          <p className="help" style={{ margin: 0 }}>Respondemos en el día hábil. Contanos el nombre del local y qué pasó.</p>
        </div>

        <section>
          <h2>Si tenés una tarjeta de un local</h2>
          <div className="faq" style={{ margin: '16px 0 0' }}>
            {CUSTOMER_FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section>
          <h2>Si tenés un negocio</h2>
          <div className="faq" style={{ margin: '16px 0 0' }}>
            {BUSINESS_FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <p style={{ marginTop: 32 }}>
          Más información en la <Link to="/privacidad">política de privacidad</Link> y los <Link to="/terminos">términos y condiciones</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
