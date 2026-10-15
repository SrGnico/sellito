import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CardPreview, { PlatformToggle, type WalletPlatform } from '../components/CardPreview'
import EnrollQr from '../components/EnrollQr'
import ImageField from '../components/ImageField'
import ScannerSettings from '../components/ScannerSettings'
import Spinner from '../components/Spinner'
import { businessFieldsFrom, cardConfigFrom, MAX_STAMPS, MIN_STAMPS, type CardConfig } from '../lib/cardDesign'
import { db } from '../lib/firebase'
import { accessLevel, canOperate, isReadOnly } from '../lib/subscription'
import { track } from '../lib/track'
import type { Business } from '../lib/types'

// Asistente de primeros pasos para un negocio nuevo: tarjeta lista en unos minutos.
// Los pasos 1 a 3 guardan al avanzar (si cierra a la mitad, no pierde nada). Todo se puede cambiar
// después en Panel → Tarjeta.
const STEPS = ['Logo y color', 'Premio', 'Datos', 'Escáner', 'QR'] as const

const COLORS = ['#FF9EC4', '#FFD166', '#7BD389', '#8EC5FF', '#C9A7FF', '#FF8A65', '#12372A', '#2B2B2B']
const REWARDS = ['un café gratis', '20% de descuento', '2x1 en tu próxima compra', 'un postre de regalo']

export default function SetupWizard({ business }: { business: Business }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<CardConfig>(() => cardConfigFrom(business))
  const [platform, setPlatform] = useState<WalletPlatform>('android')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const readOnly = isReadOnly(accessLevel(business.subscription))
  const update = (patch: Partial<CardConfig>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError(null)
  }

  function stepError(): string | null {
    if (step === 0 && !draft.name.trim()) return 'Escribí el nombre de tu negocio.'
    if (step === 0 && !draft.logoUrl) return 'Subí tu logo: es lo que se ve arriba de la tarjeta.'
    if (step === 1 && !draft.rewardText.trim()) return 'Contá qué se lleva el cliente al completar la tarjeta.'
    if (step === 2 && !draft.askFields.name && !draft.askFields.phone && !draft.askFields.email)
      return 'Pedí al menos un dato, así sabés quién es cada cliente.'
    return null
  }

  async function next(e?: FormEvent) {
    e?.preventDefault()
    const err = stepError()
    if (err) return setError(err)
    if (step <= 2) {
      setSaving(true)
      try {
        await updateDoc(doc(db, 'businesses', business.id), { ...businessFieldsFrom(draft), updatedAt: serverTimestamp() })
      } catch {
        setSaving(false)
        return setError('No pudimos guardar. Revisá tu conexión e intentá de nuevo.')
      }
      setSaving(false)
    }
    if (step === STEPS.length - 1) {
      track('wizard_done')
      return navigate('/panel')
    }
    setStep(step + 1)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="wizard">
      <div className="wizard-top">
        <Link to="/panel">← Panel</Link>
        <span className="help" style={{ margin: 0 }}>Paso {step + 1} de {STEPS.length}</span>
      </div>
      <ol className="wizard-steps" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'active' : i < step ? 'done' : undefined} aria-current={i === step ? 'step' : undefined}>
            <span aria-hidden="true">{i < step ? '✓' : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {/* Solo los pasos 1 a 3 son un formulario: el del PIN (paso 4) tiene el suyo y no se pueden anidar. */}
      {step <= 2 && (
        <form id="wizard-form" onSubmit={next} noValidate className="editor">
          <aside className="editor-preview">
            <div style={{ marginBottom: 12 }}>
              <PlatformToggle value={platform} onChange={setPlatform} />
            </div>
            <CardPreview config={draft} filled={Math.min(2, draft.stampsRequired)} platform={platform} />
          </aside>

          <fieldset className="editor-form" disabled={readOnly || saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            {step === 0 && (
              <section className="card">
                <h2>Tu marca</h2>
                <p className="help" style={{ marginTop: 0 }}>Así te reconocen tus clientes en el celular.</p>
                <div>
                  <label className="label" htmlFor="wz-name">Nombre del negocio</label>
                  <input id="wz-name" className="input" maxLength={80} value={draft.name} onChange={(e) => update({ name: e.target.value })} />
                </div>
                <ImageField id="wz-logo" label="Logo" help="Cuadrado, PNG, JPG o WebP, hasta 2 MB." businessId={business.id} kind="logo"
                  value={draft.logoUrl} onChange={(logoUrl) => update({ logoUrl })} />
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="label">Color de la tarjeta</legend>
                  <div className="swatches">
                    {COLORS.map((c) => (
                      <label key={c} className="swatch" style={{ background: c }} title={c}>
                        <input className="sr-only" type="radio" name="wz-color" checked={draft.bgColor.toUpperCase() === c} onChange={() => update({ bgColor: c })} />
                        <span className="sr-only">{c}</span>
                      </label>
                    ))}
                    <label className="swatch swatch-custom" title="Otro color">
                      <input type="color" aria-label="Otro color" value={draft.bgColor} onChange={(e) => update({ bgColor: e.target.value.toUpperCase() })} />
                    </label>
                  </div>
                </fieldset>
              </section>
            )}

            {step === 1 && (
              <section className="card">
                <h2>El premio</h2>
                <p className="help" style={{ marginTop: 0 }}>Puede ser un producto, un descuento o lo que quieras regalar.</p>
                <div>
                  <label className="label" htmlFor="wz-stamps">Sellos para el premio: {draft.stampsRequired}</label>
                  <input id="wz-stamps" type="range" min={MIN_STAMPS} max={MAX_STAMPS} value={draft.stampsRequired}
                    onChange={(e) => update({ stampsRequired: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--green)' }} />
                </div>
                <div>
                  <label className="label" htmlFor="wz-reward">¿Qué se lleva el cliente?</label>
                  <input id="wz-reward" className="input" maxLength={60} placeholder="Ej.: un café gratis" value={draft.rewardText}
                    onChange={(e) => update({ rewardText: e.target.value })} />
                  <div className="chips" style={{ marginTop: 8 }}>
                    {REWARDS.map((r) => (
                      <button key={r} type="button" className="chip" aria-pressed={draft.rewardText === r} onClick={() => update({ rewardText: r })}>{r}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="wz-conditions">Condiciones (opcional)</label>
                  <input id="wz-conditions" className="input" maxLength={120} placeholder="Ej.: un sello por compra mayor a $5.000"
                    value={draft.conditions} onChange={(e) => update({ conditions: e.target.value })} />
                  <p className="help">Se muestra al sumarse y en la tarjeta. Los sellos los sumás vos: vos decidís cuándo corresponde.</p>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="card">
                <h2>Datos de tus clientes</h2>
                <p className="help" style={{ marginTop: 0 }}>
                  Se los pedimos cuando guardan la tarjeta. La lista es tuya: la ves en Clientes y la podés descargar cuando quieras.
                </p>
                {([['name', 'Nombre'], ['phone', 'Teléfono'], ['email', 'Mail']] as const).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 32 }}>
                    <input className="checkbox" type="checkbox" checked={draft.askFields[key]}
                      onChange={(e) => update({ askFields: { ...draft.askFields, [key]: e.target.checked } })} />
                    {label}
                  </label>
                ))}
              </section>
            )}
          </fieldset>
        </form>
      )}

      {step === 3 && (
        <div className="section-page" style={{ marginTop: 0 }}>
          <h2>Escáner del local</h2>
          <p className="section-intro">
            Elegí un PIN. Con él, quien atiende suma sellos desde cualquier celular o computadora del local. Podés escribir el código de
            la tarjeta o leerlo con la cámara o un lector.
          </p>
          <ScannerSettings business={business} readOnly={readOnly} />
        </div>
      )}

      {step === 4 && (
        <div className="section-page" style={{ marginTop: 0 }}>
          <h2>¡Tu tarjeta está lista!</h2>
          <p className="section-intro">Desde ahora tus clientes ya pueden guardarla en el celular, sin descargar nada.</p>
          {!canOperate(accessLevel(business.subscription)) && (
            <div className="alert alert-info" role="status">
              <div>
                <span className="alert-title">Último paso: activá la suscripción</span>
                <span className="alert-text">Con la suscripción, el escáner del local suma sellos. Lo hacés desde el inicio del panel.</span>
              </div>
            </div>
          )}
          <EnrollQr business={business} />
          <p className="help">El diseño completo (ícono del sello, imagen de fondo, locales) lo encontrás en Panel → Tarjeta.</p>
        </div>
      )}

      {error && (
        <div className="alert alert-err" role="alert" style={{ marginTop: 16 }}>
          <span className="alert-text">{error}</span>
        </div>
      )}

      <div className="wizard-actions">
        {step > 0 && (
          <button className="btn" type="button" onClick={() => { setStep(step - 1); setError(null) }} disabled={saving}>
            Atrás
          </button>
        )}
        {step === 3 && (business.scannerPinVersion ?? 0) === 0 && (
          <button className="btn btn-ghost" type="button" onClick={() => setStep(4)}>Lo hago después</button>
        )}
        <button className="btn btn-primary" type={step <= 2 ? 'submit' : 'button'} form={step <= 2 ? 'wizard-form' : undefined}
          onClick={step <= 2 ? undefined : () => void next()} disabled={saving || readOnly} aria-busy={saving}>
          {saving && <Spinner small />}
          {saving ? 'Guardando…' : step === STEPS.length - 1 ? 'Ir al panel' : 'Siguiente'}
        </button>
      </div>
    </div>
  )
}
