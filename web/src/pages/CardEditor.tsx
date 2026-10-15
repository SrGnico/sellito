import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import CardPreview, { PlatformToggle, type WalletPlatform } from '../components/CardPreview'
import { businessFieldsFrom, cardConfigFrom, MAX_STAMPS, MIN_STAMPS, type CardConfig } from '../lib/cardDesign'
import { isHexColor } from '../lib/color'
import { db } from '../lib/firebase'
import StampIconSvg from '../components/StampIconSvg'
import { CHECK_ICON, STAMP_ICONS, type StampIcon } from '../lib/stampIcons'
import type { Business } from '../lib/types'
import { imageFileError, uploadBusinessImage, uploadErrorMessage } from '../lib/uploads'
import Spinner from '../components/Spinner'

export default function CardEditor({ business }: { business: Business }) {
  const [draft, setDraft] = useState<CardConfig>(() => cardConfigFrom(business))
  const [demoFilled, setDemoFilled] = useState(2)
  const [platform, setPlatform] = useState<WalletPlatform>('android')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<'saved' | 'error' | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  const saved = cardConfigFrom(business)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Historial para deshacer/rehacer. Los cambios seguidos sobre el mismo campo (arrastrar el
  // selector de color, escribir) se agrupan en un solo paso.
  const [history, setHistory] = useState<{ past: CardConfig[]; future: CardConfig[] }>({ past: [], future: [] })
  const lastEdit = useRef<{ keys: string; at: number } | null>(null)

  function update(patch: Partial<CardConfig>) {
    const keys = Object.keys(patch).sort().join()
    const now = Date.now()
    const grouped = lastEdit.current?.keys === keys && now - lastEdit.current.at < 1000
    lastEdit.current = { keys, at: now }
    if (!grouped) setHistory((h) => ({ past: [...h.past, draft].slice(-50), future: [] }))
    setDraft((d) => ({ ...d, ...patch }))
    setResult(null)
  }

  function undo() {
    const prev = history.past.at(-1)
    if (!prev) return
    setHistory({ past: history.past.slice(0, -1), future: [draft, ...history.future] })
    setDraft(prev)
    lastEdit.current = null
    setResult(null)
  }

  function redo() {
    const next = history.future[0]
    if (!next) return
    setHistory({ past: [...history.past, draft], future: history.future.slice(1) })
    setDraft(next)
    lastEdit.current = null
    setResult(null)
  }

  function discard() {
    setHistory({ past: [...history.past, draft], future: [] })
    setDraft(saved)
    lastEdit.current = null
    setResult(null)
  }

  // Cmd/Ctrl+Z y Cmd/Ctrl+Shift+Z, salvo dentro de un campo de texto (ahí manda el deshacer nativo).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement
      if (t.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color]), textarea')) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) {
      setNameError('Escribí el nombre de tu negocio.')
      document.getElementById('card-name')?.focus()
      return
    }
    setNameError(null)
    setSaving(true)
    setResult(null)
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        ...businessFieldsFrom(draft),
        updatedAt: serverTimestamp(),
      })
      // Igualar el borrador a lo guardado (sin espacios sobrantes) para que no quede "sin guardar".
      setDraft((d) => ({ ...d, name: d.name.trim(), rewardText: d.rewardText.trim() }))
      setResult('saved')
    } catch {
      setResult('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} noValidate>
      <Link to="/panel">← Volver al panel</Link>
      <h2 style={{ marginTop: 16 }}>Diseñá tu tarjeta</h2>
      <p style={{ color: 'var(--text-soft)', marginTop: 8 }}>
        Los cambios se ven al instante en la vista previa. Cuando te guste, guardalo.
      </p>

      <div className="editor">
        <aside className="editor-preview">
          <div style={{ marginBottom: 12 }}>
            <PlatformToggle value={platform} onChange={setPlatform} />
          </div>
          <CardPreview config={draft} filled={demoFilled} platform={platform} />
          <div style={{ marginTop: 16 }}>
            <label className="label" htmlFor="demo-filled">
              Probá cómo se ve con {Math.min(demoFilled, draft.stampsRequired)} sellos
            </label>
            <input
              id="demo-filled"
              type="range"
              min={0}
              max={draft.stampsRequired}
              value={Math.min(demoFilled, draft.stampsRequired)}
              onChange={(e) => setDemoFilled(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--green)' }}
            />
          </div>
        </aside>

        <div className="editor-form">
          <section className="card">
            <h4>Nombre y logo</h4>
            <div>
              <label className="label" htmlFor="card-name">Nombre del negocio</label>
              <input
                id="card-name"
                className="input"
                value={draft.name}
                maxLength={80}
                onChange={(e) => update({ name: e.target.value })}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? 'card-name-error' : undefined}
              />
              {nameError && <p className="help help-error" id="card-name-error">{nameError}</p>}
            </div>
            <ImageField
              id="logo"
              label="Logo"
              help="Cuadrado, PNG, JPG o WebP, hasta 2 MB."
              businessId={business.id}
              kind="logo"
              value={draft.logoUrl}
              onChange={(logoUrl) => update({ logoUrl })}
            />
            <ImageField
              id="banner"
              label="Imagen de fondo (opcional)"
              help="Horizontal, ideal 1032 × 336 px. Va detrás de los sellos."
              businessId={business.id}
              kind="banner"
              value={draft.bannerUrl}
              onChange={(bannerUrl) => update({ bannerUrl })}
            />
          </section>

          <section className="card">
            <h4>Color</h4>
            <ColorField
              id="bg-color"
              label="Fondo de la tarjeta"
              value={draft.bgColor}
              savedValue={saved.bgColor}
              onChange={(bgColor) => update({ bgColor })}
            />
            <p className="help" style={{ marginTop: 0 }}>
              El texto y los sellos se ponen blancos u oscuros solos, según el fondo, para que siempre se lean.
            </p>
          </section>

          <section className="card">
            <h4>Ícono del sello</h4>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label">Elegí uno</legend>
              <div className="icon-grid">
                <IconOption
                  icon={CHECK_ICON}
                  checked={!draft.stampIconId && !draft.stampIconUrl}
                  onSelect={() => update({ stampIconId: undefined, stampIconUrl: undefined })}
                />
                {STAMP_ICONS.map((icon) => (
                  <IconOption
                    key={icon.id}
                    icon={icon}
                    checked={draft.stampIconId === icon.id && !draft.stampIconUrl}
                    onSelect={() => update({ stampIconId: icon.id, stampIconUrl: undefined })}
                  />
                ))}
              </div>
            </fieldset>
            <ImageField
              id="stamp-icon"
              label="O subí tu propio ícono"
              help="Cuadrado, PNG con fondo transparente."
              businessId={business.id}
              kind="stamp"
              value={draft.stampIconUrl}
              onChange={(stampIconUrl) => update({ stampIconUrl, stampIconId: stampIconUrl ? undefined : draft.stampIconId })}
            />
          </section>

          <section className="card">
            <h4>Premio</h4>
            <div>
              <label className="label" htmlFor="stamps-required">
                Sellos para el premio: {draft.stampsRequired}
              </label>
              <input
                id="stamps-required"
                type="range"
                min={MIN_STAMPS}
                max={MAX_STAMPS}
                value={draft.stampsRequired}
                onChange={(e) => update({ stampsRequired: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--green)' }}
              />
            </div>
            <div>
              <label className="label" htmlFor="reward-text">¿Qué se lleva el cliente?</label>
              <input
                id="reward-text"
                className="input"
                placeholder="Ej.: un café gratis"
                maxLength={60}
                value={draft.rewardText}
                onChange={(e) => update({ rewardText: e.target.value })}
                aria-describedby="reward-help"
              />
              <p className="help" id="reward-help">
                En la tarjeta va a decir: “Al juntar {draft.stampsRequired} sellos: {draft.rewardText.trim() || '…'}”
              </p>
            </div>
          </section>

          <section className="card">
            <h4>Datos del cliente</h4>
            <p className="help" style={{ marginTop: 0 }}>Se los pedimos cuando se suma la tarjeta. Pedí solo lo que vas a usar.</p>
            {(
              [
                ['name', 'Nombre'],
                ['phone', 'Teléfono'],
                ['email', 'Mail'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 32 }}>
                <input
                  className="checkbox"
                  type="checkbox"
                  checked={draft.askFields[key]}
                  onChange={(e) => update({ askFields: { ...draft.askFields, [key]: e.target.checked } })}
                />
                {label}
              </label>
            ))}
          </section>
        </div>
      </div>

      <div className="save-bar">
        <span role="status" className={result === 'error' ? 'help help-error' : 'help'} style={{ margin: 0 }}>
          {result === 'saved' && '✓ Cambios guardados'}
          {result === 'error' && 'No pudimos guardar. Revisá tu conexión e intentá de nuevo.'}
          {result === null && (dirty ? 'Tenés cambios sin guardar' : 'Todo guardado')}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" type="button" onClick={undo} disabled={history.past.length === 0} title="Deshacer (⌘Z)">
            ↶ Deshacer
          </button>
          <button className="btn btn-sm" type="button" onClick={redo} disabled={history.future.length === 0} title="Rehacer (⇧⌘Z)">
            ↷ Rehacer
          </button>
          {dirty && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={discard}>
              Descartar cambios
            </button>
          )}
          <button className="btn btn-primary" type="submit" disabled={!dirty || saving} aria-busy={saving}>
            {saving && <Spinner small />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </form>
  )
}

function IconOption({ icon, checked, onSelect }: { icon: StampIcon; checked: boolean; onSelect: () => void }) {
  return (
    <label className="icon-option">
      <input className="sr-only" type="radio" name="stamp-icon" checked={checked} onChange={onSelect} />
      <StampIconSvg icon={icon} width={28} height={28} aria-hidden="true" />
      {icon.label}
    </label>
  )
}

type ColorFieldProps = { id: string; label: string; value: string; savedValue: string; onChange: (v: string) => void }

function ColorField({ id, label, value, savedValue, onChange }: ColorFieldProps) {
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  // Si el color cambia desde el selector, sincronizar el campo de texto.
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }
  const invalid = !isHexColor(text)

  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="color"
          aria-label={`${label}: selector`}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          style={{ width: 56, height: 48, padding: 0, border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'none', cursor: 'pointer', flexShrink: 0 }}
        />
        <input
          id={id}
          className="input"
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value.trim()
            setText(v)
            if (isHexColor(v)) onChange(v.toUpperCase())
          }}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
        />
      </div>
      {invalid && <p className="help help-error" id={`${id}-error`}>Usá el formato #RRGGBB, por ejemplo #FF9EC4.</p>}
      {value.toUpperCase() !== savedValue.toUpperCase() && (
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => onChange(savedValue)} style={{ paddingLeft: 0, marginTop: 4 }}>
          <span
            aria-hidden="true"
            style={{ width: 18, height: 18, borderRadius: 6, border: '2px solid var(--border)', background: savedValue, flexShrink: 0 }}
          />
          Volver al guardado ({savedValue})
        </button>
      )}
    </div>
  )
}

type ImageFieldProps = {
  id: string
  label: string
  help: string
  businessId: string
  kind: 'logo' | 'banner' | 'stamp'
  value?: string
  onChange: (url: string | undefined) => void
}

function ImageField({ id, label, help, businessId, kind, value, onChange }: ImageFieldProps) {
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
              width: kind === 'banner' ? 120 : 56,
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
