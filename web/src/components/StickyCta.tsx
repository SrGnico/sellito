import { useEffect, useState } from 'react'

// Botón fijo abajo en el celular: aparece al pasar el encabezado y se esconde donde ya hay otro
// botón a la vista (precio y cierre), para no tapar ni repetir.
export default function StickyCta({ href, onClick }: { href: string; onClick?: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.querySelector('.hero-actions')
    const blockers = Array.from(document.querySelectorAll('#precio, .cta-final, .site-footer'))
    const state = new Map<Element, boolean>()
    let passedHero = false
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        state.set(e.target, e.isIntersecting)
        // Solo cuando los botones del encabezado ya quedaron arriba (no cuando todavía no se llegó a verlos).
        if (e.target === hero) passedHero = !e.isIntersecting && e.boundingClientRect.bottom < 0
      }
      const blocked = blockers.some((b) => state.get(b))
      setVisible(passedHero && !blocked)
    })
    if (hero) io.observe(hero)
    blockers.forEach((b) => io.observe(b))
    return () => io.disconnect()
  }, [])

  return (
    <div className={`sticky-cta${visible ? ' visible' : ''}`} aria-hidden={!visible}>
      <a className="btn btn-lg btn-primary" href={href} onClick={onClick} tabIndex={visible ? 0 : -1}>
        Crear mi tarjeta
      </a>
    </div>
  )
}
