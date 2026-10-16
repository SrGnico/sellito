import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import BirthdayIcon from '../components/BirthdayIcon'
import BirthdaySettings from '../components/BirthdaySettings'
import CardPreview, { PlatformToggle, type WalletPlatform } from '../components/CardPreview'
import ColorPicker from '../components/ColorPicker'
import ImageField from '../components/ImageField'
import LocationsEditor from '../components/LocationsEditor'
import Spinner from '../components/Spinner'
import StampIconSvg from '../components/StampIconSvg'
import { DEFAULT_BIRTHDAY } from '../lib/birthday'
import { businessFieldsFrom, cardConfigFrom, enrollMissing, MAX_STAMPS, MIN_STAMPS, type CardConfig } from '../lib/cardDesign'
import { toast } from '../lib/feedback'
import { db } from '../lib/firebase'
import { MAX_LOCATIONS, proximityText } from '../lib/proximity'
import { CHECK_ICON, STAMP_ICONS, type StampIcon } from '../lib/stampIcons'
import { accessLevel, isDraft, isReadOnly } from '../lib/subscription'
import { track } from '../lib/track'
import type { Business } from '../lib/types'

// Editor de la tarjeta, paso a paso. Es el mismo para armarla la primera vez (/panel/configurar) y para
// cambiarla después (/panel/tarjeta). Cada paso guarda al avanzar: si cierra a la mitad, no pierde nada.
// Con la tarjeta ya armada, los pasos de arriba se pueden tocar para ir directo a uno.
// ?paso=<id> abre directo en un paso (lo usan los accesos del inicio).
const STEPS = [
  { id: 'marca', label: 'Marca' },
  { id: 'diseno', label: 'Diseño' },
  { id: 'premio', label: 'Premio' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'locales', label: 'Locales' },
] as const

const REWARDS = ['un café gratis', '20% de descuento', '2x1 en tu próxima compra', 'un postre de regalo']

// Compara sin depender del orden de las claves (Firestore puede devolver los mapas en otro orden).
const stableJson = (value: unknown) =>
  JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v))

export default function SetupWizard({ business }: { business: Business }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState(() => Math.max(0, STEPS.findIndex((s) => s.id === params.get('paso'))))
  const [draft, setDraft] = useState<CardConfig>(() => cardConfigFrom(business))
  const [platform, setPlatform] = useState<WalletPlatform>('android')
  const [demoFilled, setDemoFilled] = useState(2)
  const [saving, setSaving] = useState(false)
  const [savedSome, setSavedSome] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const readOnly = isReadOnly(accessLevel(business.subscription))
  const [draftMode] = useState(() => isDraft(business)) // fijo durante la edición aunque active a la mitad
  // Tarjeta ya armada: se puede saltar entre pasos. Si es nueva, se avanza en orden.
  const [designed] = useState(() => enrollMissing(business).length === 0)
  const [reached, setReached] = useState(designed ? STEPS.length - 1 : step)
  const dirty = stableJson(draft) !== stableJson(cardConfigFrom(business))
  const last = step === STEPS.length - 1

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const update = (patch: Partial<CardConfig>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError(null)
  }

  function stepError(i: number): string | null {
    const id = STEPS[i].id
    if (id === 'marca' && !draft.name.trim()) return 'Escribí el nombre de tu negocio.'
    if (id === 'marca' && !draft.logoUrl) return 'Subí tu logo: es lo que se ve arriba de la tarjeta.'
    if (id === 'premio' && !draft.rewardText.trim()) return 'Contá qué se lleva el cliente al completar la tarjeta.'
    if (id === 'clientes' && !draft.askFields.name && !draft.askFields.phone && !draft.askFields.email)
      return 'Pedí al menos un dato, así sabés quién es cada cliente.'
    return null
  }

  // Valida el paso actual y guarda si hay cambios. Devuelve false si no se puede seguir.
  async function saveStep(): Promise<boolean> {
    if (readOnly) return true
    const err = stepError(step)
    if (err) {
      setError(err)
      return false
    }
    if (!dirty) return true
    setSaving(true)
    try {
      await updateDoc(doc(db, 'businesses', business.id), { ...businessFieldsFrom(draft), updatedAt: serverTimestamp() })
      setDraft((d) => ({ ...d, name: d.name.trim(), rewardText: d.rewardText.trim() }))
      setSavedSome(true)
      return true
    } catch {
      setError('No pudimos guardar. Revisá tu conexión e intentá de nuevo.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function goTo(i: number) {
    if (i === step || saving) return
    // Para atrás se puede ir siempre; si el paso actual está incompleto, lo guarda después.
    if (i < step && stepError(step)) {
      setStep(i)
      setError(null)
      return
    }
    if (!(await saveStep())) return
    setStep(i)
    setReached((r) => Math.max(r, i))
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function next(e?: FormEvent) {
    e?.preventDefault()
    if (!last) return goTo(step + 1)
    if (!(await saveStep())) return
    // Todos los pasos tienen que estar completos (con la tarjeta armada se puede haber saltado alguno).
    const missing = STEPS.findIndex((_, i) => stepError(i))
    if (!readOnly && missing >= 0) {
      setStep(missing)
      setError(stepError(missing))
      return
    }
    if (draftMode) {
      track('wizard_done')
      return navigate('/panel/vista-previa')
    }
    if (savedSome) toast('Cambios guardados. Las tarjetas de tus clientes se actualizan solas.')
    navigate('/panel')
  }

  return (
    <div className="wizard">
      <div className="wizard-top">
        <Link to="/panel">← Panel</Link>
        <span className="help" style={{ margin: 0 }}>Paso {step + 1} de {STEPS.length}</span>
      </div>
      <ol className="wizard-steps" aria-label="Pasos">
        {STEPS.map((s, i) => {
          const state = i === step ? 'active' : i < step || i <= reached ? 'done' : undefined
          const clickable = i !== step && i <= reached
          return (
            <li key={s.id} className={state} aria-current={i === step ? 'step' : undefined}>
              {clickable ? (
                <button type="button" onClick={() => void goTo(i)} disabled={saving}>
                  <span aria-hidden="true">{i < step || designed ? '✓' : i + 1}</span>
                  {s.label}
                </button>
              ) : (
                <>
                  <span aria-hidden="true">{i + 1}</span>
                  {s.label}
                </>
              )}
            </li>
          )
        })}
      </ol>

      {readOnly && (
        <div className="alert alert-info" role="status" style={{ marginBottom: 16 }}>
          <span className="alert-text">Con la suscripción vencida el panel está en modo lectura. Reactivala para volver a editar.</span>
        </div>
      )}

      <form id="wizard-form" onSubmit={next} noValidate className="editor">
        <aside className="editor-preview">
          <div className="preview-toggle">
            <PlatformToggle value={platform} onChange={setPlatform} />
          </div>
          <StablePreview config={draft} filled={Math.min(demoFilled, draft.stampsRequired)} platform={platform} />
          <div style={{ marginTop: 16 }}>
            <label className="label" htmlFor="demo-filled">Probá cómo se ve con {Math.min(demoFilled, draft.stampsRequired)} sellos</label>
            <input id="demo-filled" type="range" min={0} max={draft.stampsRequired} value={Math.min(demoFilled, draft.stampsRequired)}
              onChange={(e) => setDemoFilled(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--green)' }} />
          </div>
        </aside>

        <fieldset className="editor-form" disabled={readOnly || saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {STEPS[step].id === 'marca' && (
            <section className="card">
              <h2>Tu marca</h2>
              <p className="help" style={{ marginTop: 0 }}>Así te reconocen tus clientes en el celular.</p>
              <div>
                <label className="label" htmlFor="wz-name">Nombre del negocio</label>
                <input id="wz-name" className="input" maxLength={80} value={draft.name} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <ImageField id="wz-logo" label="Logo" help="Cuadrado, PNG, JPG o WebP, hasta 2 MB." businessId={business.id} kind="logo"
                value={draft.logoUrl} onChange={(logoUrl) => update({ logoUrl })} />
              <ImageField id="wz-wide-logo" label="Logo con el nombre (opcional)"
                help="Si tu logo ya dice el nombre del negocio, subilo horizontal acá: la tarjeta lo muestra solo, sin repetir el nombre. PNG con fondo transparente."
                businessId={business.id} kind="wideLogo" value={draft.wideLogoUrl} onChange={(wideLogoUrl) => update({ wideLogoUrl })} />
              <ColorPicker value={draft.bgColor} onChange={(bgColor) => update({ bgColor })} />
            </section>
          )}

          {STEPS[step].id === 'diseno' && (
            <section className="card">
              <h2>Diseño de la tarjeta</h2>
              <p className="help" style={{ marginTop: 0 }}>El sello que se marca en cada visita y una imagen de fondo, si querés.</p>
              <StampIconPicker businessId={business.id} config={draft} onChange={update} />
              <ImageField id="wz-banner" label="Imagen de fondo (opcional)" help="Horizontal, ideal 1032 × 336 px. Va detrás de los sellos."
                businessId={business.id} kind="banner" value={draft.bannerUrl} onChange={(bannerUrl) => update({ bannerUrl })} />
            </section>
          )}

          {STEPS[step].id === 'premio' && (
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
                  onChange={(e) => update({ rewardText: e.target.value })} aria-describedby="wz-reward-help" />
                <div className="chips" style={{ marginTop: 8 }}>
                  {REWARDS.map((r) => (
                    <button key={r} type="button" className="chip" aria-pressed={draft.rewardText === r} onClick={() => update({ rewardText: r })}>{r}</button>
                  ))}
                </div>
                <p className="help" id="wz-reward-help">
                  En la tarjeta va a decir: “Al juntar {draft.stampsRequired} sellos: {draft.rewardText.trim() || '…'}”
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label className="label" htmlFor="wz-item-singular">¿Qué se cuenta? (uno, opcional)</label>
                  <input id="wz-item-singular" className="input" placeholder="Ej.: café" maxLength={30}
                    value={draft.itemSingular} onChange={(e) => update({ itemSingular: e.target.value })} aria-describedby="wz-item-help" />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label className="label" htmlFor="wz-item-plural">(varios)</label>
                  <input id="wz-item-plural" className="input" placeholder="Ej.: cafés" maxLength={30}
                    value={draft.itemPlural} onChange={(e) => update({ itemPlural: e.target.value })} aria-describedby="wz-item-help" />
                </div>
              </div>
              <p className="help" id="wz-item-help" style={{ marginTop: -8 }}>
                Se usa en los avisos: “{proximityText(draft, Math.max(0, draft.stampsRequired - 3))}”. Si lo dejás vacío, dice “sellos”.
              </p>
              <div>
                <label className="label" htmlFor="wz-conditions">Condiciones (opcional)</label>
                <input id="wz-conditions" className="input" maxLength={120} placeholder="Ej.: un sello por compra mayor a $5.000"
                  value={draft.conditions} onChange={(e) => update({ conditions: e.target.value })} />
                <p className="help">Se muestra al sumarse y en la tarjeta. Los sellos los sumás vos: vos decidís cuándo corresponde.</p>
              </div>
            </section>
          )}

          {STEPS[step].id === 'clientes' && (
            <section className="card">
              <h2>Datos de tus clientes</h2>
              <p className="help" style={{ marginTop: 0 }}>
                Se los pedimos cuando guardan la tarjeta. La lista es tuya: la ves en Clientes y la podés descargar cuando quieras.
              </p>
              {([['name', 'Nombre'], ['phone', 'Teléfono'], ['email', 'Mail'], ['birthday', 'Cumpleaños']] as const).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 32 }}>
                  <input className="checkbox" type="checkbox" checked={draft.askFields[key] ?? false}
                    onChange={(e) => update({ askFields: { ...draft.askFields, [key]: e.target.checked } })} />
                  {label}
                </label>
              ))}
              <h4 className="h-with-icon" style={{ marginTop: 8 }}><BirthdayIcon size={28} /> Regalo de cumpleaños</h4>
              <BirthdaySettings
                value={draft.birthday ?? DEFAULT_BIRTHDAY}
                onChange={(birthday) => update({ birthday })}
                askBirthday={draft.askFields.birthday ?? false}
                onAskBirthday={(ask) => update({ askFields: { ...draft.askFields, birthday: ask } })}
                businessName={draft.name}
                rewardText={draft.rewardText}
              />
            </section>
          )}

          {STEPS[step].id === 'locales' && (
            <section className="card">
              <h2>Locales y cercanía</h2>
              <p className="help" style={{ marginTop: 0 }}>
                Opcional. Cargá hasta {MAX_LOCATIONS} locales. Si activás la cercanía, la tarjeta puede aparecer en la pantalla de bloqueo
                del cliente cuando está cerca de uno. No aparece siempre: depende del celular, de la ubicación y de los permisos que dio
                cada cliente.
              </p>
              <LocationsEditor businessId={business.id} value={draft.locations} onChange={(locations) => update({ locations })} />
              <div className="switch-row">
                <button id="proximity-switch" className="switch" type="button" role="switch" aria-checked={draft.proximityEnabled}
                  aria-labelledby="proximity-label" aria-describedby="proximity-help"
                  onClick={() => update({ proximityEnabled: !draft.proximityEnabled })}>
                  <span className="knob" />
                </button>
                <span id="proximity-label">Mostrar mi tarjeta cuando el cliente está cerca</span>
              </div>
              <p className="help" id="proximity-help" style={{ marginTop: 0 }}>
                {draft.proximityEnabled && draft.locations.length === 0
                  ? 'Agregá al menos un local para que funcione.'
                  : draft.proximityEnabled
                    ? 'Así puede verse en iPhone. En Android, el texto del aviso lo escribe Google; el tuyo aparece dentro de la tarjeta.'
                    : 'Apagado, la tarjeta no lleva ninguna ubicación.'}
              </p>
              {draft.proximityEnabled && draft.locations.length > 0 && (
                <div className="lockscreen-preview" aria-label="Ejemplo de aviso en la pantalla de bloqueo">
                  <span className="lockscreen-icon" aria-hidden="true" style={{ background: draft.bgColor }} />
                  <div>
                    <strong>{draft.name.trim() || 'Tu negocio'}</strong>
                    <span>{proximityText(draft, Math.max(0, draft.stampsRequired - 3))}</span>
                  </div>
                </div>
              )}
            </section>
          )}

          {error && (
            <div className="alert alert-err" role="alert">
              <span className="alert-text">{error}</span>
            </div>
          )}
        </fieldset>
      </form>

      <div className="save-bar wizard-bar">
        <span role="status" className="help" style={{ margin: 0 }}>
          {saving ? 'Guardando…' : readOnly ? 'Modo lectura' : dirty ? 'Se guarda al pasar de paso' : savedSome || designed ? '✓ Todo guardado' : ''}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button className="btn" type="button" onClick={() => void goTo(step - 1)} disabled={saving}>Atrás</button>
          )}
          <button className="btn btn-primary" type="submit" form="wizard-form" disabled={saving} aria-busy={saving}>
            {saving && <Spinner small />}
            {last ? (draftMode ? 'Ver cómo queda' : readOnly ? 'Volver al panel' : 'Guardar y salir') : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Las dos versiones (Android y iPhone) quedan una encima de la otra y se ve una sola: la caja mide lo
// que la más alta, así cambiar de celular no mueve la página, y el cambio es un fundido suave.
function StablePreview({ config, filled, platform }: { config: CardConfig; filled: number; platform: WalletPlatform }) {
  return (
    <div className="preview-stack">
      {(['android', 'iphone'] as const).map((p) => (
        <div key={p} className={p === platform ? 'on' : undefined} aria-hidden={p !== platform} inert={p !== platform}>
          <CardPreview config={config} filled={filled} platform={p} />
        </div>
      ))}
    </div>
  )
}

// Íconos del sello: se ven unos pocos y el resto se despliega. La imagen propia queda guardada aparte
// (customStampUrl): elegir un ícono no la borra, y se puede volver a ella con un toque.
const VISIBLE_ICONS = 6

function StampIconPicker({ businessId, config, onChange }: { businessId: string; config: CardConfig; onChange: (p: Partial<CardConfig>) => void }) {
  const custom = config.customStampUrl
  const usingCustom = Boolean(config.stampIconUrl)
  const first = STAMP_ICONS.slice(0, VISIBLE_ICONS)
  const rest = STAMP_ICONS.slice(VISIBLE_ICONS)
  // Si el ícono elegido está entre los de abajo, arranca desplegado para que se vea.
  const [open, setOpen] = useState(() => !usingCustom && rest.some((i) => i.id === config.stampIconId))
  const preset = (icon: StampIcon) => (
    <IconOption key={icon.id} icon={icon} checked={!usingCustom && config.stampIconId === icon.id}
      onSelect={() => onChange({ stampIconId: icon.id, stampIconUrl: undefined })} />
  )

  return (
    <>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Ícono del sello</legend>
        <div className="icon-grid">
          {custom && (
            <label className="icon-option">
              <input className="sr-only" type="radio" name="stamp-icon" checked={usingCustom}
                onChange={() => onChange({ stampIconUrl: custom, stampIconId: undefined })} />
              <img src={custom} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover' }} />
              Tu imagen
            </label>
          )}
          <IconOption icon={CHECK_ICON} checked={!usingCustom && !config.stampIconId}
            onSelect={() => onChange({ stampIconId: undefined, stampIconUrl: undefined })} />
          {first.map(preset)}
        </div>
        <div id="more-icons" className={open ? 'icon-more open' : 'icon-more'} inert={!open}>
          <div>
            <div className="icon-grid">{rest.map(preset)}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm icon-more-toggle" type="button" aria-expanded={open} aria-controls="more-icons"
          onClick={() => setOpen((o) => !o)}>
          {open ? 'Ver menos' : `Ver ${rest.length} íconos más`}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </fieldset>
      <ImageField id="wz-stamp-icon" label={custom ? 'Tu imagen como sello' : 'O subí tu propio ícono'}
        help="Cuadrado, PNG con fondo transparente. Queda guardada aunque elijas otro ícono." businessId={businessId} kind="stamp" value={custom}
        onChange={(url) => onChange(url ? { customStampUrl: url, stampIconUrl: url, stampIconId: undefined } : { customStampUrl: undefined, stampIconUrl: undefined })} />
    </>
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
