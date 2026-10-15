import { useRef, useState, type ChangeEvent } from 'react'
import { imageFileError, uploadBusinessImage, uploadErrorMessage } from '../lib/uploads'
import Spinner from './Spinner'

// Subir una imagen del negocio (logo, fondo o ícono del sello) a Storage. Lo usan el editor y el asistente.
type ImageFieldProps = {
  id: string
  label: string
  help: string
  businessId: string
  kind: 'logo' | 'wideLogo' | 'banner' | 'stamp'
  value?: string
  onChange: (url: string | undefined) => void
}

export default function ImageField({ id, label, help, businessId, kind, value, onChange }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const fileError = imageFileError(file)
    if (fileError) {
      setError(fileError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      onChange(await uploadBusinessImage(businessId, kind, file))
    } catch (err) {
      setError(uploadErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <span className="label" id={`${id}-label`}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {value && (
          <img
            src={value}
            alt=""
            style={{
              width: kind === 'banner' || kind === 'wideLogo' ? 120 : 56,
              height: 56,
              objectFit: kind === 'banner' ? 'cover' : 'contain',
              border: '2px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--cream-deep)',
            }}
          />
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
        <button
          className="btn btn-sm"
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => inputRef.current?.click()}
          aria-describedby={`${id}-label ${id}-help`}
        >
          {busy && <Spinner small />}
          {busy ? 'Subiendo…' : value ? 'Cambiar' : 'Subir imagen'}
        </button>
        {value && !busy && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onChange(undefined)}>
            Quitar
          </button>
        )}
      </div>
      {error ? (
        <p className="help help-error" id={`${id}-help`} role="alert">{error}</p>
      ) : (
        <p className="help" id={`${id}-help`}>{help}</p>
      )}
    </div>
  )
}
