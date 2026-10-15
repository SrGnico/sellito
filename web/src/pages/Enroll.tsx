import { FirebaseError } from 'firebase/app'
import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import CardPreview from '../components/CardPreview'
import { CONSENT_VERSION, consentText } from '../content/privacy'
import { DEFAULT_CARD, type CardConfig } from '../lib/cardDesign'
import { callable } from '../lib/firebase'
import type { Business } from '../lib/types'
import EmptyState from '../components/EmptyState'
import LoadingScreen from '../components/LoadingScreen'
import Spinner from '../components/Spinner'

type EnrollInfo =
  | { ready: false; name: string; paused?: boolean }
  | {
      ready: true
      name: string
      design: NonNullable<Business['design']>
      rule: NonNullable<Business['rule']>
      askFields: NonNullable<Business['askFields']>
    }

type Field = 'name' | 'phone' | 'email'

const getEnrollInfo = callable<{ code: string }, EnrollInfo>('getEnrollInfo')
const createCard = callable<
  {
    code: string
    platform: 'google' | 'apple'
    customer: Partial<Record<Field, string>>
    consent: boolean
    consentVersion: string
  },
  { saveUrl: string }
>('createCard')

function isIOS() {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

const FIELDS: { key: Field; label: string; type: string; autoComplete: string; error: string }[] = [
  { key: 'name', label: 'Tu nombre', type: 'text', autoComplete: 'name', error: 'Escribí tu nombre.' },
  { key: 'phone', label: 'Tu teléfono', type: 'tel', autoComplete: 'tel', error: 'Ingresá un teléfono válido, por ejemplo 11 2345 6789.' },
  { key: 'email', label: 'Tu mail', type: 'email', autoComplete: 'email', error: 'Ingresá un mail válido.' },
]

export default function Enroll() {
  const { code = '' } = useParams()
  const [info, setInfo] = useState<EnrollInfo | 'loading' | 'not-found' | 'error'>('loading')
  const [values, setValues] = useState<Partial<Record<Field, string>>>({})
  const [consent, setConsent] = useState(false)
  const [fieldError, setFieldError] = useState<Field | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveUrl, setSaveUrl] = useState<string | null>(null)
  const ios = isIOS()

  useEffect(() => {
    getEnrollInfo({ code })
      .then((r) => setInfo(r.data))
      .catch((err) => setInfo(err instanceof FirebaseError && err.code === 'functions/not-found' ? 'not-found' : 'error'))
  }, [code])

  if (info === 'loading') return <LoadingScreen label="Cargando la tarjeta…" />
  if (info === 'not-found' || info === 'error') {
    return (
      <main>
        {info === 'not-found' ? (
          <EmptyState illustration="404" title="No encontramos este negocio">
            Revisá que el QR sea el del local y volvé a escanearlo.
          </EmptyState>
        ) : (
          <EmptyState
            illustration="offline"
            title="No pudimos conectarnos"
            action={<button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>Reintentar</button>}
          >
            Revisá tu conexión a internet y volvé a probar.
          </EmptyState>
        )}
      </main>
    )
  }
  if (!info.ready && info.paused) {
    return (
      <main>
        <EmptyState illustration="expired" title={`${info.name} no está sumando clientes por ahora`}>
          Si ya tenés tu tarjeta, sigue en tu celular con todos tus sellos.
        </EmptyState>
      </main>
    )
  }
  if (!info.ready) {
    return (
      <main>
        <h2>{info.name}</h2>
        <div className="alert alert-info" role="status" style={{ marginTop: 24 }}>
          <div>
            <span className="alert-title">La tarjeta todavía no está lista</span>
            <span className="alert-text">El local la está terminando de armar. Probá de nuevo en unos días.</span>
          </div>
        </div>
      </main>
    )
  }

  const config: CardConfig = {
    name: info.name,
    ...info.design,
    bgColor: info.design.bgColor ?? DEFAULT_CARD.bgColor,
    stampsRequired: info.rule.stampsRequired,
    rewardText: info.rule.rewardText,
    itemSingular: info.rule.itemSingular ?? '',
    itemPlural: info.rule.itemPlural ?? '',
    askFields: info.askFields,
    // La vista previa del alta no muestra ubicaciones.
    locations: [],
    proximityEnabled: false,
  }
  const fields = FIELDS.filter((f) => info.askFields[f.key])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldError(null)
    const empty = fields.find((f) => !values[f.key]?.trim())
    if (empty) {
      setFieldError(empty.key)
      document.getElementById(`enroll-${empty.key}`)?.focus()
      return
    }
    setBusy(true)
    try {
      const r = await createCard({ code, platform: 'google', customer: values, consent, consentVersion: CONSENT_VERSION })
      setSaveUrl(r.data.saveUrl)
      window.location.assign(r.data.saveUrl)
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ''
      const field = err instanceof FirebaseError ? (err.message as Field) : null
      if (code === 'functions/invalid-argument' && field && fields.some((f) => f.key === field)) {
        setFieldError(field)
        document.getElementById(`enroll-${field}`)?.focus()
      } else if (code === 'functions/failed-precondition' && err instanceof FirebaseError && err.message === 'paused') {
        setInfo({ ready: false, paused: true, name: config.name })
      } else if (code === 'functions/resource-exhausted') {
        setError('Hubo muchos intentos desde esta conexión. Esperá un rato y probá de nuevo.')
      } else {
        setError('No pudimos crear tu tarjeta. Revisá tu conexión e intentá de nuevo.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 440 }}>
      <h2>Sumate a la tarjeta de {info.name}</h2>
      <p style={{ color: 'var(--text-soft)', marginTop: 8 }}>
        Juntá {info.rule.stampsRequired} sellos y llevate: <strong>{info.rule.rewardText}</strong>. Sin descargar ninguna app.
      </p>

      <div className="enroll-preview" style={{ margin: '24px 0' }}>
        <CardPreview config={config} filled={0} platform={ios ? 'iphone' : 'android'} />
      </div>

      {saveUrl ? (
        <div className="alert alert-ok" role="status">
          <div>
            <span className="alert-title">¡Tu tarjeta está lista!</span>
            <span className="alert-text">
              Si no se abrió sola, <a href={saveUrl}>tocá acá para agregarla a Google Wallet</a>.
            </span>
          </div>
        </div>
      ) : ios ? (
        <div className="alert alert-info" role="status">
          <div>
            <span className="alert-title">Apple Wallet llega pronto</span>
            <span className="alert-text">Por ahora la tarjeta funciona en celulares Android con Google Wallet.</span>
          </div>
        </div>
      ) : (
        <form className="card" onSubmit={handleSubmit} noValidate style={{ gap: 16 }}>
          {error && (
            <div className="alert alert-err" role="alert">
              <span className="alert-text">{error}</span>
            </div>
          )}
          {fields.map((f) => (
            <div key={f.key}>
              <label className="label" htmlFor={`enroll-${f.key}`}>{f.label}</label>
              <input
                id={`enroll-${f.key}`}
                className="input"
                type={f.type}
                autoComplete={f.autoComplete}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                aria-invalid={fieldError === f.key ? true : undefined}
                aria-describedby={fieldError === f.key ? `enroll-${f.key}-error` : undefined}
              />
              {fieldError === f.key && <p className="help help-error" id={`enroll-${f.key}-error`}>{f.error}</p>}
            </div>
          ))}
          {fields.length > 0 && (
            <>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                <input className="checkbox" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>{consentText(info.name)} (opcional)</span>
              </label>
              <p className="help" style={{ margin: 0 }}>Tus datos los usa solo {info.name} para tu tarjeta de sellos.</p>
            </>
          )}
          {/* TODO: reemplazar por el botón oficial "Add to Google Wallet" (guía de marca de Google). */}
          <button className="btn btn-lg btn-primary" type="submit" disabled={busy} aria-busy={busy}>
            {busy && <Spinner small />}
            {busy ? 'Creando tu tarjeta…' : 'Agregar a Google Wallet'}
          </button>
        </form>
      )}
    </main>
  )
}
