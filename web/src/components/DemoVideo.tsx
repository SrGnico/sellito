import { useEffect, useRef, useState } from 'react'
import { DEMO_VIDEO } from '../content/brand'

// "Miralo en acción": sin la barra del reproductor. Arranca solo (sin sonido, en loop) cuando se ve en
// pantalla y se pausa al salir. Tocándolo se pausa o se reanuda. Aparece solo si el video existe en
// web/public (si no, Hosting devuelve la página de la app y el tipo no es video).
export default function DemoVideo() {
  const [available, setAvailable] = useState(false)
  const [playing, setPlaying] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)
  // En pantallas chicas, la versión 720p.
  const [src] = useState(() => (window.matchMedia('(max-width: 760px)').matches ? DEMO_VIDEO.srcMobile : DEMO_VIDEO.src))

  useEffect(() => {
    fetch(src, { method: 'HEAD' })
      .then((r) => setAvailable(r.ok && (r.headers.get('content-type') ?? '').startsWith('video/')))
      .catch(() => setAvailable(false))
  }, [src])

  useEffect(() => {
    const video = ref.current
    if (!available || !video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) video.play().catch(() => setPlaying(false))
      else video.pause()
    }, { threshold: 0.4 })
    io.observe(video)
    return () => io.disconnect()
  }, [available])

  function toggle() {
    const video = ref.current
    if (!video) return
    if (video.paused) video.play().catch(() => undefined)
    else video.pause()
  }

  if (!available) return null
  return (
    <section className="section video-section">
      <h2>Miralo en acción</h2>
      <p className="section-lead">De la tarjetita de cartón a la tarjeta en el celular, en menos de un minuto.</p>
      <div className="video-frame">
        <video
          ref={ref}
          src={src}
          poster={DEMO_VIDEO.poster}
          muted
          loop
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={toggle}
        />
        <button className={`video-toggle${playing ? ' playing' : ''}`} type="button" onClick={toggle} aria-label={playing ? 'Pausar el video' : 'Reproducir el video'}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
          )}
        </button>
      </div>
    </section>
  )
}
