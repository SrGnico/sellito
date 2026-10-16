import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { captureAttribution } from '../lib/attribution'
import { loadPixel, pixelAllowedPath, pixelConfigured, pixelConsent, pixelEvent, setPixelConsent } from '../lib/metaPixel'

// Va una vez en App: guarda el origen de campaña (utm/fbclid), carga el Pixel donde corresponde, manda
// PageView en cada cambio de ruta y muestra el aviso de cookies la primera vez.
export default function MetaPixel() {
  const { pathname } = useLocation()
  const allowed = pixelAllowedPath(pathname)
  const [answered, setAnswered] = useState(() => pixelConsent() !== null)

  useEffect(() => {
    if (!allowed) return
    captureAttribution()
    loadPixel()
    pixelEvent('PageView')
  }, [pathname, allowed])

  if (!allowed || !pixelConfigured() || answered) return null
  return (
    <div className="cookie-notice" role="region" aria-label="Aviso de cookies">
      <p>
        Usamos cookies de Meta para medir nuestros anuncios. <Link to="/privacidad">Más info</Link>
      </p>
      <div className="cookie-actions">
        <button className="btn btn-sm btn-ghost" type="button" onClick={() => setPixelConsent(false)}>No, gracias</button>
        <button className="btn btn-sm btn-primary" type="button" onClick={() => { setPixelConsent(true); setAnswered(true) }}>Entendido</button>
      </div>
    </div>
  )
}
