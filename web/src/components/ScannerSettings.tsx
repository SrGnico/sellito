import QRCode from 'qrcode'
import { useEffect, useState, type FormEvent } from 'react'
import { scannerError, setScannerPin } from '../lib/scanner'
import type { Business } from '../lib/types'
import { APP_URL } from '../lib/urls'
import Spinner from './Spinner'
import { confirmar, toast } from '../lib/feedback'

// Panel → escáner del local: PIN compartido (v1) y link/QR para abrirlo en el celular del local.
export default function ScannerSettings({ business, readOnly = false }: { business: Business; readOnly?: boolean }) {
  const hasPin = (business.scannerPinVersion ?? 0) > 0
  const url = `${APP_URL}/escaner/${business.id}`
  const [editing, setEditing] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(url, { width: 400, margin: 2, color: { dark: '#12372A', light: '#FFFFFF' } }).then(setQr)
  }, [url])

  return (
    <div className="card" style={{ gap: 12 }}>
      <h4>Escáner del local</h4>
      <p style={{ margin: 0, color: 'var(--text-soft)' }}>
        Con el escáner sumás sellos y canjeás premios desde cualquier celular del local. Se entra con un PIN.
      </p>

      {readOnly ? (
        <div className="alert alert-err" role="status">
          <span className="alert-text">El escáner está en pausa hasta que reactives la suscripción. El PIN no se puede cambiar.</span>
        </div>
      ) : !hasPin || editing ? (
        <PinForm business={business} hasPin={hasPin} onDone={() => setEditing(false)} />
      ) : (
        <>
          <p style={{ margin: 0 }}>
            <span className="badge badge-ok">PIN activo</span>
          </p>
          <p style={{ margin: 0 }}>Escaneá este QR con el celular del local, o abrí el link:</p>
          {qr && (
            <img
              src={qr}
              alt={`Código QR que abre el escáner: ${url}`}
              width={160}
              height={160}
              style={{ border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#fff' }}
            />
          )}
          <code style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{url}</code>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  setCopied(false)
                }
              }}
            >
              {copied ? '✓ Copiado' : 'Copiar link'}
            </button>
            <a className="btn btn-sm" href={`/escaner/${business.id}`} target="_blank" rel="noreferrer">
              Abrir escáner
            </a>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(true)}>
              Cambiar PIN
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function PinForm({ business, hasPin, onDone }: { business: Business; hasPin: boolean; onDone: () => void }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(pin)) return setError('Usá entre 4 y 6 números.')
    if (pin !== confirm) return setError('Los dos PIN no coinciden. Escribilos de nuevo.')
    if (hasPin && !(await confirmar({
      title: '¿Cambiar el PIN?',
      text: 'Los celulares que tengan el escáner abierto van a tener que entrar de nuevo con el PIN nuevo.',
      confirmLabel: 'Cambiar PIN',
    }))) return
    setBusy(true)
    setError(null)
    try {
      await setScannerPin({ businessId: business.id, pin })
      toast(hasPin ? 'PIN cambiado' : 'PIN creado. Ya podés abrir el escáner.')
      onDone()
    } catch (err) {
      setError(scannerError(err).reason === 'pin' ? 'Usá entre 4 y 6 números.' : 'No pudimos guardar el PIN. Intentá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {hasPin && (
        <div className="alert alert-info" role="status">
          <span className="alert-text">Al cambiar el PIN, los celulares que tengan el escáner abierto van a tener que entrar de nuevo.</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label className="label" htmlFor="pin-new">{hasPin ? 'PIN nuevo' : 'Elegí un PIN'}</label>
          <input id="pin-new" className="input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} aria-describedby="pin-help" />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label className="label" htmlFor="pin-confirm">Repetilo</label>
          <input id="pin-confirm" className="input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
            value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))} />
        </div>
      </div>
      {error ? (
        <p className="help help-error" role="alert" style={{ margin: 0 }}>{error}</p>
      ) : (
        <p className="help" id="pin-help" style={{ margin: 0 }}>Entre 4 y 6 números. Compartilo solo con quienes atienden.</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm" type="submit" disabled={busy} aria-busy={busy}>
          {busy && <Spinner small />}
          {busy ? 'Guardando…' : 'Guardar PIN'}
        </button>
        {hasPin && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={onDone}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
