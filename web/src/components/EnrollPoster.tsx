import { useEffect, useState } from 'react'
import { enrollMissing } from '../lib/cardDesign'
import { callable } from '../lib/firebase'
import type { Business } from '../lib/types'
import Spinner from './Spinner'

const enrollPoster = callable<{ businessId: string }, { png: string }>('enrollPoster')

// Afiche A4 para imprimir con el QR de alta (lo arma functions/src/images/poster.ts con los colores,
// la foto y el logo de la tarjeta).
export default function EnrollPoster({ business }: { business: Business }) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const ready = enrollMissing(business).length === 0 && Boolean(business.enrollCode)

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])

  if (!ready) return null

  async function generate() {
    setBusy(true)
    setError(false)
    try {
      const { png } = (await enrollPoster({ businessId: business.id })).data
      const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0))
      setUrl(URL.createObjectURL(new Blob([bytes], { type: 'image/png' })))
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const fileName = `afiche-${business.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'qr'}.png`

  return (
    <div className="card" style={{ gap: 12 }}>
      <h4>Afiche para el mostrador</h4>
      <p style={{ margin: 0, color: 'var(--text-soft)' }}>
        Un cartel listo para imprimir en A4 o A5, con tus colores, tu foto y el QR. Si cambiás la tarjeta, generalo de nuevo.
      </p>
      {url && <img src={url} alt="Vista previa del afiche con el QR" className="poster-preview" />}
      {error && (
        <p className="help help-error" role="alert" style={{ margin: 0 }}>
          No pudimos generar el afiche. Intentá de nuevo.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {url ? (
          <>
            <a className="btn btn-sm btn-primary" href={url} download={fileName}>
              Descargar afiche
            </a>
            <button className="btn btn-sm" type="button" onClick={generate} disabled={busy} aria-busy={busy}>
              {busy && <Spinner small />}
              {busy ? 'Generando…' : 'Generar de nuevo'}
            </button>
          </>
        ) : (
          <button className="btn btn-sm btn-primary" type="button" onClick={generate} disabled={busy} aria-busy={busy}>
            {busy && <Spinner small />}
            {busy ? 'Generando el afiche…' : 'Generar afiche'}
          </button>
        )}
      </div>
    </div>
  )
}
