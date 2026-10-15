import { useEffect, useState } from 'react'
import step1 from '../assets/onboarding-1-disena.svg'
import step2 from '../assets/onboarding-2-wallet.svg'
import step3 from '../assets/onboarding-3-escanea.svg'
import appleBadge from '../assets/wallet/add-to-apple-wallet-esmx.svg'
import googleBadge from '../assets/wallet/add-to-google-wallet-es419.svg'
import CardPreview from '../components/CardPreview'
import DemoCard from '../components/DemoCard'
import DemoVideo from '../components/DemoVideo'
import PhoneMockup from '../components/PhoneMockup'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import StickyCta from '../components/StickyCta'
import YourCard from '../components/YourCard'
import { DEMO_ENROLL_CODE } from '../content/brand'
import { EXAMPLES } from '../content/examples'
import { RESPONSIBLE } from '../content/legal'
import { formatMoney, useMonthlyPlan } from '../lib/subscription'
import { track } from '../lib/track'
import { APP_NAME, APP_URL, SITE_URL } from '../lib/urls'
import '../styles/landing.css'

// Landing de venta (misellito.com.ar). Mensajes clave (pedido del dueño del producto):
// 1) sirve para cualquier negocio que quiera juntar datos de sus clientes, darles una tarjeta y regalar algo;
// 2) no se descarga nada: el cliente la guarda en su Wallet y el local suma sellos desde un celular o una compu;
// 3) la lista de clientes (los leads) es el resultado: es solo del negocio, siempre, aunque deje de pagar.

const MORE_BUSINESSES = 'panaderías, gimnasios, lavaderos, veterinarias, librerías, kioscos, estéticas, barberías, verdulerías…'

// Lista de clientes de muestra (inventada) para la sección "Tu lista de clientes".
const SAMPLE_CUSTOMERS = [
  { name: 'Martina G.', stamps: '7 de 8', last: 'hoy', tag: 'Casi premio' },
  { name: 'Lucas R.', stamps: '3 de 8', last: 'hace 2 días', tag: '' },
  { name: 'Sofía P.', stamps: '8 de 8', last: 'ayer', tag: 'Premio listo' },
  { name: 'Diego F.', stamps: '1 de 8', last: 'hace 34 días', tag: 'No vuelve' },
]

const demoUrl = `${SITE_URL}/c/${DEMO_ENROLL_CODE}`

const signupUrl = `${APP_URL}/login?registro=1`

export default function Landing() {
  const plan = useMonthlyPlan()
  const [i, setI] = useState(0)
  const example = EXAMPLES[i]
  const [rubro, setRubro] = useState(0)
  const perDay = plan ? Math.ceil(plan.amount / 30 / 10) * 10 : null

  useEffect(() => {
    document.title = `${APP_NAME} · Tarjetas de fidelidad en el celular de tus clientes`
    track('landing_view')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), 3500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="site">
      <SiteHeader />

      <main>
        {/* ---------- Encabezado ---------- */}
        {/* Primera pantalla: encabezado + franja de confianza, justo del alto de la ventana (en computadora). */}
        <div className="hero-screen">
        <section className="hero">
          <div className="hero-text">
            <p className="eyebrow">Tarjetas de fidelidad digitales</p>
            <h1>Tu tarjeta de sellos, en el celular de tus clientes</h1>
            <p className="hero-lead">
              La guardan con un QR, sin descargar nada. Vos sumás sellos desde el celular o la compu, y te quedás con la lista de
              tus clientes.
            </p>
            <div className="hero-actions">
              <a className="btn btn-lg btn-primary" href={signupUrl} onClick={() => track('cta_click')}>Crear mi tarjeta</a>
              <a className="btn btn-lg" href="#probala">Probala en tu celular</a>
            </div>
            <p className="hero-note">
              Diseñarla es gratis.<span className="hide-mobile"> Pagás recién cuando empezás a sumar sellos.</span>
            </p>
          </div>
          {/* En computadora el celular va al lado del texto; en el celular, debajo de la franja de confianza. */}
          <div className="hero-card hero-card-side" aria-hidden="true">
            <PhoneMockup example={example} />
          </div>
        </section>

        {/* ---------- Confianza ---------- */}
        <section className="trust-bar" aria-label="Con quién funciona">
          <div className="trust">
            <span className="trust-label">Funciona con</span>
            <a href={demoUrl} aria-label="Probar la tarjeta de ejemplo en Apple Wallet"><img src={appleBadge} alt="Agregar a Apple Wallet" height={34} /></a>
            <a href={demoUrl} aria-label="Probar la tarjeta de ejemplo en Google Wallet"><img src={googleBadge} alt="Agregar a la Billetera de Google" height={34} /></a>
          </div>
          <TrustPoints className="hide-mobile" />
        </section>
        </div>
        <div className="hero-below">
          <div className="hero-card" aria-hidden="true">
            <PhoneMockup example={example} />
          </div>
          <TrustPoints />
        </div>

        {/* ---------- Sin descargas ---------- */}
        <section className="band">
          <div className="band-grid">
            <div>
              <h3>Tus clientes</h3>
              <p>Escanean el QR del mostrador, ponen su nombre y la tarjeta queda en su Wallet. Sin apps, sin registrarse, sin cartón que se pierde.</p>
            </div>
            <div>
              <h3>Vos</h3>
              <p>Escaneás la tarjeta con el celular o un lector, o tipeás su código en la compu de la caja. Tocás “+1 sello” y listo.</p>
            </div>
            <div>
              <h3>La tarjeta</h3>
              <p>Se actualiza sola en el celular de tu cliente con cada sello. Cuando completa, le avisa que tiene su premio.</p>
            </div>
          </div>
        </section>

        {/* ---------- Cómo funciona ---------- */}
        <section id="como-funciona" className="section">
          <h2>Cómo funciona</h2>
          <ol className="steps">
            <li>
              <img src={step1} alt="" width={320} height={240} />
              <h3>1. Armá tu tarjeta</h3>
              <p>Tu logo, tus colores, una foto y el premio: “a los 8 cafés, el siguiente es gratis”. Ves cómo queda mientras la editás.</p>
            </li>
            <li>
              <img src={step2} alt="" width={320} height={240} />
              <h3>2. Tus clientes la guardan</h3>
              <p>Imprimís el afiche con tu QR. Lo escanean con la cámara y la tarjeta queda en su celular, en iPhone o Android.</p>
            </li>
            <li>
              <img src={step3} alt="" width={320} height={240} />
              <h3>3. Sumás sellos</h3>
              <p>En cada compra escaneás su tarjeta o tipeás el código. El sello aparece al instante en el celular de tu cliente.</p>
            </li>
          </ol>
        </section>

        <DemoVideo />

        <DemoCard />

        {/* ---------- La lista es tuya ---------- */}
        <section className="section leads">
          <div className="leads-text">
            <p className="eyebrow">Lo más valioso</p>
            <h2>Tu lista de clientes, siempre tuya</h2>
            <p className="section-lead" style={{ textAlign: 'left', margin: '12px 0 0' }}>
              Cada persona que guarda tu tarjeta te deja sus datos. Con el tiempo armás una lista de clientes reales que ya te
              compraron: la base para que vuelvan.
            </p>
            <div className="sample-list" aria-hidden="true">
              <div className="sample-list-head">
                <strong>Clientes</strong>
                <span>Descargar ↓</span>
              </div>
              {SAMPLE_CUSTOMERS.map((c) => (
                <div key={c.name} className="sample-row">
                  <span className="sample-avatar">{c.name.charAt(0)}</span>
                  <span className="sample-name">{c.name}<small>{c.last}</small></span>
                  {c.tag && <span className={`sample-tag${c.tag === 'No vuelve' ? ' warn' : ''}`}>{c.tag}</span>}
                  <span className="sample-stamps">{c.stamps}</span>
                </div>
              ))}
            </div>
          </div>
          <ul className="leads-list">
            <li><strong>Elegís qué pedir:</strong> nombre, teléfono, mail, o solo lo que necesites.</li>
            <li><strong>Ves quién vuelve y quién no:</strong> cuántos sellos lleva cada uno, quiénes tienen premio y quiénes hace rato que no pasan.</li>
            <li><strong>Es solo tuya:</strong> no la compartimos con nadie ni la usamos para otra cosa.</li>
            <li><strong>La descargás cuando quieras,</strong> en un archivo que abrís con Excel o Google Sheets.</li>
            <li><strong>Si dejás de pagar, no se pierde:</strong> la seguís pudiendo descargar. Solo se borra si vos nos lo pedís.</li>
          </ul>
        </section>

        {/* ---------- Para cualquier negocio ---------- */}
        <section className="section section-alt">
          <h2>Sirve para cualquier negocio</h2>
          <p className="section-lead">Vos elegís qué se cuenta y qué se regala: un producto, un descuento o lo que quieras. Tocá un rubro:</p>
          <div className="rubros" role="tablist" aria-label="Ejemplos por rubro">
            {EXAMPLES.map((ex, n) => (
              <button key={ex.rubro} role="tab" type="button" aria-selected={rubro === n} className="rubro-chip" onClick={() => setRubro(n)}>
                {ex.rubro}
              </button>
            ))}
            <button role="tab" type="button" aria-selected={rubro === EXAMPLES.length} className="rubro-chip rubro-chip-yours" onClick={() => setRubro(EXAMPLES.length)}>
              Y el tuyo ✨
            </button>
          </div>
          {rubro === EXAMPLES.length ? (
            <div role="tabpanel" className="fade-up">
              <YourCard signupUrl={signupUrl} onCta={() => track('cta_click')} />
            </div>
          ) : (
            <div className="rubro-example" role="tabpanel">
              <div key={rubro} className="rubro-card fade-up">
                <CardPreview config={EXAMPLES[rubro]} filled={EXAMPLES[rubro].filled} />
              </div>
              <div className="rubro-text">
                <h3>{EXAMPLES[rubro].name}</h3>
                <p className="rubro-rule">
                  {EXAMPLES[rubro].stampsRequired} {EXAMPLES[rubro].itemPlural} = <strong>{EXAMPLES[rubro].rewardText}</strong>
                </p>
                <p className="help" style={{ margin: 0 }}>Y también: {MORE_BUSINESSES} Si tenés clientes que vuelven, sirve.</p>
                <button className="btn" type="button" onClick={() => setRubro(EXAMPLES.length)} style={{ alignSelf: 'flex-start' }}>
                  Probá con el tuyo →
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ---------- Qué incluye ---------- */}
        <section className="section">
          <h2>Todo lo que necesitás</h2>
          <div className="features">
            <article className="card">
              <h3>Clientes que vuelven</h3>
              <p>El premio les da un motivo para volver, y cada sello te muestra quién viene seguido y quién no.</p>
            </article>
            <article className="card">
              <h3>Avisos en el celular</h3>
              <p>Mandá una promo o un “doble sello este sábado” y le llega como notificación a tus clientes. Sin WhatsApp ni mails.</p>
            </article>
            <article className="card">
              <h3>Cerca de tu local</h3>
              <p>Cargá tus locales y la tarjeta puede aparecer en la pantalla de bloqueo cuando tu cliente está cerca.</p>
            </article>
            <article className="card">
              <h3>Con tu marca</h3>
              <p>Tu logo, tus colores y tu foto en la tarjeta y en el afiche para el mostrador, listo para imprimir.</p>
            </article>
            <article className="card">
              <h3>Escáner para el local</h3>
              <p>Con la cámara del celular, con un lector de QR o tipeando el código en la compu de la caja. Se entra con un PIN.</p>
            </article>
            <article className="card card-pink">
              <h3>Estadísticas simples</h3>
              <p>Clientes nuevos, sellos del mes y premios canjeados, de un vistazo.</p>
            </article>
          </div>
        </section>

        {/* ---------- Precio ---------- */}
        <section id="precio" className="section section-alt">
          <h2>Un solo precio, todo incluido</h2>
          <div className="price card">
            <span className="price-label">{plan?.name ?? 'Mensual'}</span>
            <span className="price-amount">
              {plan ? formatMoney(plan.amount, plan.currency) : <span className="skeleton" style={{ display: 'inline-block', width: 180, height: 48 }} />}
              <small> por mes</small>
            </span>
            <ul>
              <li>Clientes y tarjetas ilimitados</li>
              <li>Tu lista de clientes, descargable siempre</li>
              <li>Apple Wallet y Google Wallet</li>
              <li>Escáner para todos los celulares del local</li>
              <li>Afiche con QR, avisos y cercanía</li>
              <li>Cancelás cuando quieras</li>
            </ul>
            {perDay && (
              <p className="price-day">
                Menos de <strong>{formatMoney(perDay, plan?.currency)}</strong> por día. Si un solo cliente vuelve una vez más por semana, ya se pagó.
              </p>
            )}
            <a className="btn btn-lg btn-primary" href={signupUrl} onClick={() => track('cta_click')}>Crear mi tarjeta</a>
            <p className="hero-note">Se paga con Mercado Pago. Diseñar la tarjeta es gratis.</p>
          </div>
          <p className="section-lead price-reward">
            ¿Y el premio? Casi no se nota: es un café cada 8, para alguien que ya volvió 8 veces. Es la forma más barata de que te
            elijan a vos.
          </p>
        </section>

        {/* ---------- Preguntas ---------- */}
        <section className="section">
          <h2>Preguntas frecuentes</h2>
          <div className="faq">
            {[
              ['¿Mis clientes tienen que descargar una app?', 'No. Escanean el QR con la cámara y guardan la tarjeta en Apple Wallet o Google Wallet, que ya vienen en el celular.'],
              ['¿Qué necesito para sumar sellos?', 'Un celular o una computadora con internet. Escaneás la tarjeta con la cámara o con un lector de QR, o tipeás los 4 caracteres que tiene debajo del código. Podés usarlo en varios equipos a la vez.'],
              ['¿Funciona en iPhone y en Android?', 'Sí. En iPhone la tarjeta va a Apple Wallet y en Android a Google Wallet.'],
              ['¿Sirve para mi rubro?', 'Si tenés clientes que vuelven, sí: cafeterías, peluquerías, gimnasios, kioscos, veterinarias o lo que sea. Vos elegís qué se cuenta y qué se regala.'],
              ['¿La tarjeta aparece sola cuando el cliente pasa por el local?', 'Puede aparecer en la pantalla de bloqueo cuando está cerca, si cargás tus locales. Depende del celular y de sus permisos, así que no aparece siempre.'],
              ['¿Puedo mandarles promociones?', 'Sí. Desde el panel escribís un aviso y les llega como notificación en el celular, en la tarjeta. Solo a quienes aceptaron recibir novedades, y como máximo uno por día para que no se vuelva molesto.'],
              ['¿Puedo poner condiciones o regalar un descuento?', 'Sí. El premio lo escribís vos (un café, un 20% de descuento, lo que quieras) y podés aclarar condiciones, como “un sello por compra mayor a $5.000”. Los sellos los sumás vos, así que siempre decidís cuándo corresponde.'],
              ['¿Puedo cancelar?', 'Sí, cuando quieras desde tu cuenta de Mercado Pago. Seguís usando el servicio hasta el final del período pagado.'],
              ['¿De quién son los datos de mis clientes?', 'Solo tuyos. Los descargás cuando quieras y nosotros solo los guardamos para que tu tarjeta funcione: no los compartimos ni los usamos para otra cosa.'],
              ['¿Qué pasa con mi lista si dejo de pagar?', 'No se borra. El escáner se pausa, pero tu lista sigue ahí y la podés descargar cuando quieras. Solo se elimina si nos lo pedís.'],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- Cierre ---------- */}
        <section className="cta-final">
          <h2>Empezá hoy con tu tarjeta</h2>
          <p>La armás en minutos. Tus clientes la guardan en segundos.</p>
          <a className="btn btn-lg btn-secondary" href={signupUrl} onClick={() => track('cta_click')}>Crear mi tarjeta</a>
          <p className="hero-note">¿Dudas? Escribinos a <a href={`mailto:${RESPONSIBLE.email}`}>{RESPONSIBLE.email}</a></p>
        </section>
      </main>

      <SiteFooter />
      <StickyCta href={signupUrl} onClick={() => track('cta_click')} />
    </div>
  )
}

function TrustPoints({ className }: { className?: string }) {
  return (
    <ul className={`trust-points${className ? ` ${className}` : ''}`}>
      <li><LockIcon /> Datos cifrados en servidores de Google</li>
      <li><CardIcon /> Pagos con Mercado Pago</li>
      <li><PinIcon /> Hecho en Córdoba, Argentina</li>
    </ul>
  )
}

const iconProps = { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
const LockIcon = () => <svg {...iconProps}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
const CardIcon = () => <svg {...iconProps}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></svg>
const PinIcon = () => <svg {...iconProps}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
