import { useEffect, useState } from 'react'
import step1 from '../assets/onboarding-1-disena.svg'
import step2 from '../assets/onboarding-2-wallet.svg'
import step3 from '../assets/onboarding-3-escanea.svg'
import CardPreview from '../components/CardPreview'
import DemoCard from '../components/DemoCard'
import DemoVideo from '../components/DemoVideo'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { RESPONSIBLE } from '../content/legal'
import type { CardConfig } from '../lib/cardDesign'
import { formatMoney, useMonthlyPlan } from '../lib/subscription'
import { APP_NAME, APP_URL } from '../lib/urls'
import '../styles/landing.css'

// Landing de venta (misellito.com.ar). Mensajes clave (pedido del dueño del producto):
// 1) sirve para cualquier negocio que quiera juntar datos de sus clientes, darles una tarjeta y regalar algo;
// 2) no se descarga nada: el cliente la guarda en su Wallet y el local suma sellos desde un celular o una compu;
// 3) la lista de clientes (los leads) es el resultado: es solo del negocio, siempre, aunque deje de pagar.

const base = { askFields: { name: true, phone: true, email: false }, locations: [], proximityEnabled: false }

// Ejemplos que van rotando en la tarjeta del encabezado: muestran que sirve para cualquier rubro.
const EXAMPLES: (CardConfig & { filled: number })[] = [
  { ...base, name: 'Café Lola', bgColor: '#FF9EC4', stampIconId: 'cafe', stampsRequired: 8, rewardText: 'un café gratis', itemSingular: 'café', itemPlural: 'cafés', filled: 5 },
  { ...base, name: 'Peluquería Sol', bgColor: '#12372A', stampIconId: 'tijera', stampsRequired: 6, rewardText: 'un corte gratis', itemSingular: 'corte', itemPlural: 'cortes', filled: 4 },
  { ...base, name: 'Heladería Nube', bgColor: '#FFD3E4', stampIconId: 'helado', stampsRequired: 10, rewardText: 'un cuarto de helado', itemSingular: 'helado', itemPlural: 'helados', filled: 7 },
  { ...base, name: 'Pizzería Don Tano', bgColor: '#C23838', stampIconId: 'pizza', stampsRequired: 8, rewardText: 'una pizza grande', itemSingular: 'pizza', itemPlural: 'pizzas', filled: 3 },
]

const BUSINESSES = ['Cafeterías', 'Peluquerías', 'Heladerías', 'Panaderías', 'Pizzerías', 'Gimnasios', 'Lavaderos', 'Veterinarias', 'Librerías', 'Kioscos', 'Estéticas', 'Y el tuyo']

const signupUrl = `${APP_URL}/login?registro=1`

export default function Landing() {
  const plan = useMonthlyPlan()
  const [i, setI] = useState(0)
  const example = EXAMPLES[i]

  useEffect(() => {
    document.title = `${APP_NAME} · Tarjetas de fidelidad en el celular de tus clientes`
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), 3500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="site">
      <SiteHeader />

      <main>
        {/* ---------- Encabezado ---------- */}
        <section className="hero">
          <div className="hero-text">
            <p className="eyebrow">Tarjetas de fidelidad digitales</p>
            <h1>Tu tarjeta de sellos, en el celular de tus clientes</h1>
            <p className="hero-lead">
              Conocé a tus clientes, armá tu propia lista de contactos y hacé que vuelvan. Para cualquier negocio. Simple.
            </p>
            <ul className="hero-points">
              <li><strong>No se descarga nada.</strong> Tus clientes escanean un QR y la guardan en Apple Wallet o Google Wallet.</li>
              <li><strong>Sumás sellos desde el celular o la compu de la caja:</strong> escaneás la tarjeta o tipeás su código.</li>
              <li><strong>Te quedás con la lista de tus clientes.</strong> Es tuya y la descargás cuando quieras.</li>
            </ul>
            <div className="hero-actions">
              <a className="btn btn-lg btn-primary" href={signupUrl}>Crear mi tarjeta</a>
              <a className="btn btn-lg" href="#probala">Probala en tu celular</a>
            </div>
            <p className="hero-note">Diseñar tu tarjeta es gratis. Pagás recién cuando empezás a sumar sellos.</p>
          </div>
          <div className="hero-card" aria-hidden="true">
            <div key={i} className="card-swap">
              <CardPreview config={example} filled={example.filled} />
            </div>
          </div>
        </section>

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
          <p className="section-lead">Si tenés clientes que vuelven, podés premiarlos. Y de paso conocés quiénes son.</p>
          <ul className="chips-cloud">
            {BUSINESSES.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
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
              <p>Cuando sumás un sello o tu cliente completa la tarjeta, le llega un aviso. Sin que tengas que hacer nada.</p>
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
            <a className="btn btn-lg btn-primary" href={signupUrl}>Crear mi tarjeta</a>
            <p className="hero-note">Se paga con Mercado Pago. Diseñar la tarjeta es gratis.</p>
          </div>
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
          <a className="btn btn-lg btn-secondary" href={signupUrl}>Crear mi tarjeta</a>
          <p className="hero-note">¿Dudas? Escribinos a <a href={`mailto:${RESPONSIBLE.email}`}>{RESPONSIBLE.email}</a></p>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
