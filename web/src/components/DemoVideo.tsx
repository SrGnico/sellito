import { useEffect, useState } from 'react'
import { DEMO_VIDEO } from '../content/brand'

// "Miralo en acción": aparece solo cuando el video existe en web/public (si no, Hosting devuelve la
// página de la app y el tipo no es video).
export default function DemoVideo() {
  const [available, setAvailable] = useState(false)
  // En pantallas chicas, la versión 720p.
  const [src] = useState(() => (window.matchMedia('(max-width: 760px)').matches ? DEMO_VIDEO.srcMobile : DEMO_VIDEO.src))

  useEffect(() => {
    fetch(src, { method: 'HEAD' })
      .then((r) => setAvailable(r.ok && (r.headers.get('content-type') ?? '').startsWith('video/')))
      .catch(() => setAvailable(false))
  }, [src])

  if (!available) return null
  return (
    <section className="section video-section">
      <h2>Miralo en acción</h2>
      <p className="section-lead">De la tarjetita de cartón a la tarjeta en el celular, en menos de un minuto.</p>
      <div className="video-frame">
        <video src={src} poster={DEMO_VIDEO.poster} autoPlay muted loop playsInline controls preload="metadata" />
      </div>
    </section>
  )
}
