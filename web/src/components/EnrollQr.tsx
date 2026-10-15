import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { enrollMissing } from '../lib/cardDesign'
import { callable } from '../lib/firebase'
import type { Business } from '../lib/types'
import { enrollUrl, isProvisionalUrl } from '../lib/urls'
import Spinner from './Spinner'

const ensureEnrollCode = callable<{ businessId: string }, { code: string }>('ensureEnrollCode')

export default function EnrollQr({ business }: { business: Business }) {
  const missing = enrollMissing(business)
  const code = business.enrollCode
  const url = code ? enrollUrl(code) : null
  const provisional = url ? isProvisionalUrl(url) : false
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [codeError, setCodeError] = useState(false)

  // El código se asigna una sola vez; el panel lo recibe por el snapshot del negocio.
  useEffect(() => {
    if (code || missing.length > 0) return
    ensureEnrollCode({ businessId: business.id }).catch(() => setCodeError(true))
  }, [code, missing.length, business.id])

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: '#12372A', light: '#FFFFFF' } }).then(setQr)
  }, [url])

  if (missing.length > 0) {
    return (
      <div className="card">
        <h4>QR para tu local</h4>
        <p style={{ margin: 0, color: 'var(--text-soft)' }}>
          Para que tus clientes puedan sumarse, a tu tarjeta le falta {missing.join(' y ')}.
        </p>
        <Link className="btn" to="tarjeta" style={{ alignSelf: 'flex-start', marginTop: 8 }}>
          Completar tarjeta
        </Link>
      </div>
    )
  }

  if (!url) {
    return (
      <div className="card">
        <h4>QR para tu local</h4>
        {codeError ? (
          <div className="alert alert-err" role="alert">
            <div>
              <span className="alert-title">No pudimos preparar tu QR</span>
              <span className="alert-text">Revisá tu conexión y recargá la página.</span>
            </div>
          </div>
        ) : (
          <p role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, color: 'var(--text-soft)' }}>
            <Spinner small /> Preparando tu QR…
          </p>
        )}
      </div>
    )
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url!)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="card" style={{ gap: 12 }}>
      <h4>QR para tu local</h4>
      <p style={{ margin: 0, color: 'var(--text-soft)' }}>
        Imprimilo y ponelo en el mostrador. Tus clientes lo escanean y suman la tarjeta a su celular.
      </p>
      {provisional && (
        <div className="alert alert-warn" role="alert">
          <div>
            <span className="alert-title">Todavía no lo imprimas</span>
            <span className="alert-text">
              Este QR usa una dirección de prueba. Sirve para probar, pero va a cambiar cuando conectemos el dominio.
            </span>
          </div>
        </div>
      )}
      {qr && (
        <img
          src={qr}
          alt={`Código QR que abre ${url}`}
          width={200}
          height={200}
          style={{ border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#fff' }}
        />
      )}
      <code style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{url}</code>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {qr && !provisional && (
          <a className="btn btn-sm" href={qr} download={`sellito-qr-${code}.png`}>
            Descargar QR
          </a>
        )}
        <button className="btn btn-sm" type="button" onClick={copy}>
          {copied ? '✓ Copiado' : 'Copiar link'}
        </button>
        <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">
          Abrir página de alta
        </a>
      </div>
    </div>
  )
}
