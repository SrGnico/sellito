import { useEffect } from 'react'
import { LEGAL_UPDATED, privacySections, termsSections } from '../content/legal'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { APP_NAME } from '../lib/urls'
import '../styles/landing.css'

// /privacidad y /terminos (se ven en misellito.com.ar y en app.misellito.com.ar).
export default function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  const title = kind === 'privacy' ? 'Política de privacidad' : 'Términos y condiciones'
  const sections = kind === 'privacy' ? privacySections(APP_NAME) : termsSections(APP_NAME)

  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])

  return (
    <div className="site">
      <SiteHeader />
      <main className="legal">
        <h1>{title}</h1>
        <p className="legal-updated">Última actualización: {LEGAL_UPDATED}</p>
        {sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            {s.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.list && (
              <ul>
                {s.list.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  )
}
