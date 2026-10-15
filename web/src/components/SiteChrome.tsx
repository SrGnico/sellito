import { Link } from 'react-router-dom'
import { RESPONSIBLE } from '../content/legal'
import { APP_NAME, APP_URL, SITE_URL } from '../lib/urls'
import Mascot from './Mascot'

// Encabezado y pie del sitio público (landing y páginas legales).
const YEAR = new Date().getFullYear()
export function SiteHeader() {
  return (
    <header className="site-header">
      <a href={SITE_URL} className="site-brand" aria-label={`${APP_NAME}, inicio`}>
        <Mascot size={32} />
        <span>{APP_NAME}</span>
      </a>
      <nav className="site-nav" aria-label="Principal">
        <a href={`${SITE_URL}/#como-funciona`}>Cómo funciona</a>
        <a href={`${SITE_URL}/#precio`}>Precio</a>
        <a className="btn btn-sm" href={`${APP_URL}/login`}>Entrar</a>
      </nav>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <Mascot size={32} />
        <div>
          <strong>{APP_NAME}</strong>
          <span>Tarjetas de fidelidad en el celular de tus clientes.</span>
        </div>
      </div>
      <nav aria-label="Legales y contacto">
        <a href={`mailto:${RESPONSIBLE.email}`}>{RESPONSIBLE.email}</a>
        <Link to="/privacidad">Privacidad</Link>
        <Link to="/terminos">Términos</Link>
      </nav>
      <p className="site-footer-legal">
        © {YEAR} {APP_NAME} · {RESPONSIBLE.name} · CUIT {RESPONSIBLE.cuit}
      </p>
    </footer>
  )
}
