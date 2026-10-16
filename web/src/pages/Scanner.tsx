import BirthdayIcon from '../components/BirthdayIcon'
import { APP_URL } from '../lib/urls'
import QrScanner from 'qr-scanner'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import reward from '../assets/reward.svg'
import EmptyState from '../components/EmptyState'
import LoadingScreen from '../components/LoadingScreen'
import Mascot from '../components/Mascot'
import Spinner from '../components/Spinner'
import StampGrid from '../components/StampGrid'
import { DEFAULT_CARD } from '../lib/cardDesign'
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/install'
import { autoTextColor } from '../lib/color'
import {
  loadToken,
  rememberScannerBusiness,
  saveToken,
  scannerError,
  scannerLogin,
  scannerLookup,
  scannerSession,
  scannerStamp,
  type ScannedCard,
  type ScannerBusiness,
} from '../lib/scanner'
import { confirmar } from '../lib/feedback'

type Phase =
  | { kind: 'loading' }
  | { kind: 'pin'; message?: string }
  | { kind: 'blocked'; reason: 'subscription' | 'no-subscription' | 'no-card' | 'not-found' }
  | { kind: 'ready'; token: string; business: ScannerBusiness }

export default function Scanner() {
  const { businessId = '' } = useParams()
  // Manifest e íconos para instalarlo como app, también desde la pantalla del PIN.
  useScannerInstallable(businessId)
  const [phase, setPhase] = useState<Phase>(() => (loadToken(businessId) ? { kind: 'loading' } : { kind: 'pin' }))

  const handleSessionError = useCallback(
    (err: unknown) => {
      const e = scannerError(err)
      if (e.reason === 'session') {
        saveToken(businessId, null)
        setPhase({ kind: 'pin', message: 'La sesión del escáner se cerró (puede que hayan cambiado el PIN). Entrá de nuevo.' })
        return true
      }
      if (e.reason === 'subscription' || e.reason === 'no-subscription' || e.reason === 'no-card') {
        setPhase({ kind: 'blocked', reason: e.reason })
        return true
      }
      return false
    },
    [businessId],
  )

  // Si este celular ya tiene sesión, entra directo.
  useEffect(() => {
    const token = loadToken(businessId)
    if (!token) return
    scannerSession({ businessId, token })
      .then((r) => setPhase({ kind: 'ready', token, business: r.data.business }))
      .catch((err) => {
        if (!handleSessionError(err)) setPhase({ kind: 'pin' })
      })
  }, [businessId, handleSessionError])

  if (phase.kind === 'loading') return <LoadingScreen label="Abriendo el escáner…" />
  if (phase.kind === 'pin') {
    return (
      <PinScreen
        businessId={businessId}
        message={phase.message}
        onLogin={(token, business) => {
          saveToken(businessId, token)
          setPhase({ kind: 'ready', token, business })
        }}
        onNotFound={() => setPhase({ kind: 'blocked', reason: 'not-found' })}
        onBlocked={(reason) => setPhase({ kind: 'blocked', reason })}
      />
    )
  }
  if (phase.kind === 'blocked') {
    return (
      <main>
        {phase.reason === 'subscription' ? (
          <EmptyState illustration="expired" title="Suscripción vencida">
            El escáner está en pausa: por ahora no se pueden sumar sellos ni canjear premios. Los clientes conservan sus
            tarjetas. Cuando el dueño reactive la suscripción, vuelve a funcionar solo.
          </EmptyState>
        ) : phase.reason === 'no-subscription' ? (
          <EmptyState illustration="expired" title="El escáner todavía no está activo">
            El dueño tiene que activar la tarjeta desde el panel, en Vista previa. Después, el escáner funciona solo.
          </EmptyState>
        ) : phase.reason === 'no-card' ? (
          <EmptyState illustration="search" title="La tarjeta todavía no está lista">
            El dueño tiene que terminar de diseñar la tarjeta desde el panel.
          </EmptyState>
        ) : (
          <EmptyState illustration="404" title="No encontramos este escáner">
            Revisá que el link sea el que aparece en el panel del negocio.
          </EmptyState>
        )}
      </main>
    )
  }
  return (
    <ScannerView
      businessId={businessId}
      token={phase.token}
      business={phase.business}
      onSessionError={handleSessionError}
      onLogout={() => {
        saveToken(businessId, null)
        setPhase({ kind: 'pin' })
      }}
    />
  )
}

// ---------- PIN ----------

function PinScreen({
  businessId,
  message,
  onLogin,
  onNotFound,
  onBlocked,
}: {
  businessId: string
  message?: string
  onLogin: (token: string, business: ScannerBusiness) => void
  onNotFound: () => void
  onBlocked: (reason: 'subscription' | 'no-subscription') => void
}) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(pin)) {
      setError('El PIN tiene entre 4 y 6 números.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await scannerLogin({ businessId, pin })
      onLogin(r.data.token, r.data.business)
    } catch (err) {
      const e = scannerError(err)
      if (e.code === 'not-found') return onNotFound()
      if (e.reason === 'subscription' || e.reason === 'no-subscription') return onBlocked(e.reason)
      setPin('')
      if (e.reason === 'wrong') setError(`PIN incorrecto. Te quedan ${e.value} intentos.`)
      else if (e.reason === 'locked') setError(`Hubo muchos intentos. Esperá ${e.value} minutos y probá de nuevo.`)
      else if (e.reason === 'no-pin') setError('Este local todavía no tiene PIN. El dueño lo crea desde el panel.')
      else setError('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="pin-screen">
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Mascot size={48} />
      </div>
      <h2 style={{ marginTop: 12, textAlign: 'center', fontSize: 'var(--text-2xl)' }}>Escáner del local</h2>
      <p style={{ textAlign: 'center', color: 'var(--text-soft)', marginTop: 6 }}>Ingresá el PIN del negocio.</p>
      <form className="card" onSubmit={handleSubmit} noValidate style={{ gap: 16, marginTop: 20 }}>
        {(error || message) && (
          <div className={error ? 'alert alert-err' : 'alert alert-info'} role={error ? 'alert' : 'status'}>
            <span className="alert-text">{error ?? message}</span>
          </div>
        )}
        <div>
          <label className="label" htmlFor="scanner-pin">PIN</label>
          <input
            id="scanner-pin"
            className="input pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            aria-invalid={error ? true : undefined}
            autoFocus
          />
        </div>
        <button className="btn btn-lg btn-primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy && <Spinner small />}
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="help" style={{ textAlign: 'center', marginTop: 16, display: 'block' }}>
        ¿Sos el dueño? <a href={`${APP_URL}/panel`}>Entrá a tu panel</a>
      </p>
    </main>
  )
}

// ---------- Panel, cámara y resultado ----------

// La cámara NO queda prendida: se abre al tocar "Escanear QR" y se apaga sola después de leer
// un código o de CAMERA_IDLE_MS sin leer nada (ahorra batería y no molesta en el mostrador).
const CAMERA_IDLE_MS = 60_000

type View =
  | { kind: 'idle' }
  | { kind: 'camera' }
  | { kind: 'searching' }
  | { kind: 'choose'; cards: ScannedCard[] }
  | { kind: 'card'; card: ScannedCard; cooldown?: number }
  | { kind: 'done'; card: ScannedCard; action: 'add' | 'redeem' | 'birthday' }
  | { kind: 'error'; message: string }

const VALID_SCAN = /^[2-9A-HJ-NP-Z]{12}$/

function ScannerView({
  businessId,
  token,
  business,
  onSessionError,
  onLogout,
}: {
  businessId: string
  token: string
  business: ScannerBusiness
  onSessionError: (err: unknown) => boolean
  onLogout: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [view, setView] = useState<View>({ kind: 'idle' })
  const [cameraError, setCameraError] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const cameraOn = view.kind === 'camera'

  const lookup = useCallback(
    async (code: string) => {
      setView({ kind: 'searching' })
      try {
        const { cards } = (await scannerLookup({ businessId, token, code })).data
        if (cards.length === 0) setView({ kind: 'error', message: 'No encontramos esa tarjeta en este local.' })
        else if (cards.length === 1) setView({ kind: 'card', card: cards[0] })
        else setView({ kind: 'choose', cards })
      } catch (err) {
        if (!onSessionError(err)) setView({ kind: 'error', message: 'No pudimos buscar la tarjeta. Revisá tu conexión.' })
      }
    },
    [businessId, token, onSessionError],
  )

  // Cámara: solo mientras view es 'camera'. Al salir de ese estado se apaga (stop + destroy).
  useEffect(() => {
    if (!cameraOn || !videoRef.current) return
    let handled = false
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        const code = result.data.trim().toUpperCase()
        if (handled || !VALID_SCAN.test(code)) return
        handled = true
        navigator.vibrate?.(40)
        lookup(code)
      },
      { preferredCamera: 'environment', maxScansPerSecond: 8, highlightScanRegion: false, returnDetailedScanResult: true },
    )
    scanner
      .start()
      .then(() => setCameraError(false))
      .catch(() => setCameraError(true))
    const idle = setTimeout(() => setView({ kind: 'idle' }), CAMERA_IDLE_MS)
    return () => {
      clearTimeout(idle)
      scanner.stop()
      scanner.destroy()
    }
  }, [cameraOn, lookup])

  async function act(card: ScannedCard, action: 'add' | 'redeem' | 'birthday', force = false) {
    setBusy(true)
    try {
      const r = await scannerStamp({ businessId, token, cardId: card.cardId, action, force })
      navigator.vibrate?.(action === 'redeem' ? [60, 60, 120] : 120)
      setView({ kind: 'done', card: r.data.card, action })
    } catch (err) {
      const e = scannerError(err)
      if (onSessionError(err)) return
      if (e.reason === 'cooldown') setView({ kind: 'card', card, cooldown: e.value ?? 0 })
      else if (e.reason === 'reward-ready') setView({ kind: 'card', card: { ...card, stamps: card.total } })
      else if (e.reason === 'birthday-redeemed' && card.birthday) setView({ kind: 'card', card: { ...card, birthday: { ...card.birthday, redeemed: true } } })
      else setView({ kind: 'error', message: 'No pudimos guardar el sello. Revisá tu conexión e intentá de nuevo.' })
    } finally {
      setBusy(false)
    }
  }

  // Lector de QR (USB o Bluetooth): se comporta como un teclado que escribe el código muy rápido y
  // termina con Enter. Se escucha siempre que no haya un cartel abierto ni se esté escribiendo en un campo.
  useEffect(() => {
    if (manualOpen || (view.kind !== 'idle' && view.kind !== 'camera' && view.kind !== 'done' && view.kind !== 'error')) return
    let buffer = ''
    let last = 0
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).matches('input, textarea')) return
      const now = Date.now()
      if (now - last > 80) buffer = '' // una persona tipeando es más lenta que un lector
      last = now
      if (e.key === 'Enter') {
        const code = buffer.toUpperCase()
        buffer = ''
        if (VALID_SCAN.test(code)) {
          e.preventDefault()
          navigator.vibrate?.(40)
          lookup(code)
        }
      } else if (e.key.length === 1) {
        buffer = (buffer + e.key).slice(-24)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view.kind, manualOpen, lookup])

  // Después de sumar o canjear, vuelve solo al panel (la cámara queda apagada).
  useEffect(() => {
    if (view.kind !== 'done') return
    const t = setTimeout(() => setView({ kind: 'idle' }), 4000)
    return () => clearTimeout(t)
  }, [view])

  const bg = business.design.bgColor ?? DEFAULT_CARD.bgColor
  const toIdle = () => setView({ kind: 'idle' })
  const openCamera = () => {
    setCameraError(false)
    setView({ kind: 'camera' })
  }
  const showSheet = view.kind !== 'idle' && view.kind !== 'camera'

  return (
    <div className="scanner">
      <header className="scanner-header">
        <strong>{business.name}</strong>
        {/* El panel pide la cuenta del dueño: a quien solo tiene el PIN no le abre nada. */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <a className="btn btn-ghost btn-sm" href={`${APP_URL}/panel`}>Panel</a>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      {cameraOn ? (
        <div className="scanner-camera">
          <video ref={videoRef} muted playsInline aria-label="Cámara para escanear la tarjeta" />
          {!cameraError && <div className="scanner-frame" aria-hidden="true" />}
          {cameraError ? (
            <div className="scanner-camera-msg" role="alert">
              <p>No pudimos abrir la cámara. Dale permiso en el navegador o tipeá el código de la tarjeta.</p>
            </div>
          ) : (
            <p className="scanner-hint">Apuntá al QR de la tarjeta del cliente</p>
          )}
          <button className="btn btn-lg scanner-close" type="button" onClick={toIdle}>
            Cerrar cámara
          </button>
        </div>
      ) : (
        <div className="scanner-idle">
          <Mascot size={96} />
          <p style={{ margin: 0, color: 'var(--text-soft)', textAlign: 'center' }}>
            Escaneá la tarjeta del cliente para sumar un sello o canjear su premio. ¿Tenés un lector de QR? Escaneala con el
            lector y listo.
          </p>
          <button className="btn btn-lg btn-primary" type="button" onClick={openCamera}>
            Escanear QR
          </button>
          <button className="btn btn-lg" type="button" onClick={() => setManualOpen(true)}>
            Tipear código
          </button>
          <InstallHint />
        </div>
      )}

      {showSheet && (
        <div className="scanner-sheet fade-up" role="dialog" aria-modal="true" aria-label="Tarjeta escaneada">
          {view.kind === 'searching' && (
            <p role="status" className="scanner-center">
              <Spinner /> Buscando la tarjeta…
            </p>
          )}

          {view.kind === 'error' && (
            <>
              <div className="alert alert-err" role="alert">
                <span className="alert-text">{view.message}</span>
              </div>
              <button className="btn btn-lg btn-primary" type="button" onClick={openCamera}>
                Escanear de nuevo
              </button>
              <button className="btn btn-ghost" type="button" onClick={toIdle}>
                Cerrar
              </button>
            </>
          )}

          {view.kind === 'choose' && (
            <>
              <h3>¿Cuál es?</h3>
              <p className="help" style={{ margin: 0 }}>Hay más de una tarjeta con ese código. Elegí por nombre.</p>
              {view.cards.map((c) => (
                <button key={c.cardId} className="btn btn-lg" type="button" onClick={() => setView({ kind: 'card', card: c })}>
                  {c.name ?? 'Sin nombre'} · {c.stamps} de {c.total}
                </button>
              ))}
              <button className="btn btn-ghost" type="button" onClick={toIdle}>
                Cancelar
              </button>
            </>
          )}

          {view.kind === 'card' && (
            <CardResult
              card={view.card}
              business={business}
              bg={bg}
              cooldown={view.cooldown}
              busy={busy}
              onAdd={(force) => act(view.card, 'add', force)}
              onRedeem={async () => {
                const ok = await confirmar({
                  title: '¿Canjear el premio?',
                  text: `Entregale ${business.rewardText}. La tarjeta vuelve a empezar de cero.`,
                  confirmLabel: 'Canjear',
                })
                if (ok) act(view.card, 'redeem')
              }}
              onBirthday={async () => {
                const ok = await confirmar({
                  title: '¿Entregar el regalo de cumpleaños?',
                  text: `Entregale ${view.card.birthday?.gift ?? 'su regalo'}. Es uno por año y no cambia sus sellos.`,
                  confirmLabel: 'Entregar',
                })
                if (ok) act(view.card, 'birthday')
              }}
              onCancel={toIdle}
            />
          )}

          {view.kind === 'done' && (
            <div className="scanner-center" role="status" style={{ flexDirection: 'column' }}>
              {view.action === 'birthday' ? (
                <>
                  <div className="stamp-in"><BirthdayIcon size={120} /></div>
                  <h2>¡Regalo de cumple entregado!</h2>
                  <p style={{ margin: 0 }}>{view.card.name ? `${view.card.name}: ` : ''}{view.card.birthday?.gift}. Sus sellos siguen igual.</p>
                </>
              ) : view.action === 'redeem' ? (
                <>
                  <img src={reward} alt="" width={200} height={150} className="stamp-in" />
                  <h2>¡Premio entregado!</h2>
                  <p style={{ margin: 0 }}>{business.rewardText}. La tarjeta vuelve a empezar.</p>
                </>
              ) : (
                <>
                  <div className="scanner-big stamp-in">+1 sello</div>
                  <p style={{ margin: 0 }}>
                    {view.card.name ? `${view.card.name}: ` : ''}
                    {view.card.stamps >= view.card.total ? '¡completó la tarjeta! El premio está listo.' : `${view.card.stamps} de ${view.card.total}`}
                  </p>
                </>
              )}
              <button className="btn btn-lg btn-primary" type="button" onClick={openCamera} style={{ marginTop: 12 }}>
                Escanear otra
              </button>
              <button className="btn btn-ghost" type="button" onClick={toIdle}>
                Listo
              </button>
            </div>
          )}
        </div>
      )}

      {manualOpen && (
        <ManualEntry
          onCancel={() => setManualOpen(false)}
          onSubmit={(code) => {
            setManualOpen(false)
            lookup(code)
          }}
        />
      )}
    </div>
  )
}

// ---------- Instalar como app ----------

// Agrega el manifest y los íconos solo en el escáner (el panel no se instala) y recuerda el local,
// así el acceso directo (que abre /escaner) vuelve a este escáner.
function useScannerInstallable(businessId: string) {
  useEffect(() => {
    rememberScannerBusiness(businessId)
    const tags = [
      Object.assign(document.createElement('link'), { rel: 'manifest', href: `/escaner/${businessId}/manifest.webmanifest` }),
      Object.assign(document.createElement('link'), { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' }),
      Object.assign(document.createElement('meta'), { name: 'theme-color', content: '#12372A' }),
      Object.assign(document.createElement('meta'), { name: 'apple-mobile-web-app-capable', content: 'yes' }),
      // Barra de estado opaca: el contenido empieza debajo de la hora (y además se respeta la zona segura en CSS).
      Object.assign(document.createElement('meta'), { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }),
      Object.assign(document.createElement('meta'), { name: 'apple-mobile-web-app-title', content: 'Escáner' }),
    ]
    tags.forEach((t) => document.head.appendChild(t))
    return () => tags.forEach((t) => t.remove())
  }, [businessId])
}

const INSTALL_DISMISSED_KEY = 'sellito-scanner:install-dismissed'

function InstallHint() {
  const [canPrompt, setCanPrompt] = useState(canPromptInstall)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => onInstallChange(() => setCanPrompt(canPromptInstall())), [])

  if (dismissed || isStandalone() || (!canPrompt && !isIOS())) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
    } catch {
      // nada
    }
  }

  return (
    <div className="card install-hint">
      <strong>Tené el escáner a mano</strong>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-soft)' }}>
        Agregalo a la pantalla de inicio y abrilo como una app, sin buscar el link.
      </p>
      {showIosHelp ? (
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 'var(--text-sm)' }}>
          <li>Tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba) de Safari.</li>
          <li>Elegí <strong>Agregar a inicio</strong>.</li>
          <li>Tocá <strong>Agregar</strong>.</li>
        </ol>
      ) : (
        <button
          className="btn btn-secondary"
          type="button"
          onClick={async () => {
            if (canPrompt) {
              if (await promptInstall()) dismiss()
            } else setShowIosHelp(true)
          }}
        >
          {canPrompt ? 'Instalar en este celular' : 'Cómo agregarlo a inicio'}
        </button>
      )}
      <button className="btn btn-ghost btn-sm" type="button" onClick={dismiss}>
        Ahora no
      </button>
    </div>
  )
}

function CardResult({
  card,
  business,
  bg,
  cooldown,
  busy,
  onAdd,
  onRedeem,
  onBirthday,
  onCancel,
}: {
  card: ScannedCard
  business: ScannerBusiness
  bg: string
  cooldown?: number
  busy: boolean
  onAdd: (force: boolean) => void
  onRedeem: () => void
  onBirthday: () => void
  onCancel: () => void
}) {
  const ready = card.stamps >= card.total
  const bday = card.birthday
  return (
    <>
      <h3>{card.name ?? 'Cliente'}</h3>
      <ClientFactsLine card={card} />
      <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--border)' }}>
        <StampGrid
          total={card.total}
          filled={card.stamps}
          bgColor={bg}
          textColor={autoTextColor(bg)}
          stampIconId={business.design.stampIconId}
          stampIconUrl={business.design.stampIconUrl}
        />
      </div>
      <p style={{ margin: 0, fontWeight: 500 }}>
        {ready ? `¡Premio listo! ${business.rewardText}` : `${card.stamps} de ${card.total} sellos`}
      </p>

      {cooldown !== undefined && (
        <div className="alert alert-warn" role="alert">
          <div>
            <span className="alert-title">Ya sumaste un sello hace {cooldown <= 0 ? 'menos de un minuto' : `${cooldown} min`}</span>
            <span className="alert-text">Si es otra compra, podés sumar igual.</span>
          </div>
        </div>
      )}

      {ready ? (
        <>
          <img src={reward} alt="" width={160} height={120} style={{ alignSelf: 'center' }} />
          <button className="btn btn-lg btn-primary" type="button" onClick={onRedeem} disabled={busy} aria-busy={busy}>
            {busy && <Spinner small />}
            {busy ? 'Canjeando…' : 'Canjear premio'}
          </button>
        </>
      ) : (
        <button className="btn btn-lg btn-primary" type="button" onClick={() => onAdd(cooldown !== undefined)} disabled={busy} aria-busy={busy}>
          {busy && <Spinner small />}
          {busy ? 'Sumando…' : cooldown !== undefined ? 'Sumar igual' : '+1 sello'}
        </button>
      )}
      {bday && (
        <div className="alert alert-info birthday-alert" role="status">
          <BirthdayIcon size={40} />
          <div style={{ flex: 1 }}>
            <span className="alert-title">¡Está de cumple!</span>
            <span className="alert-text">
              {!bday.gift ? 'Saludalo: es su cumpleaños.' : bday.redeemed ? 'Ya recibió su regalo de cumpleaños este año.' : `Tiene de regalo: ${bday.gift}.`}
            </span>
            {bday.gift && !bday.redeemed && (
              <button className="btn btn-sm" type="button" onClick={onBirthday} disabled={busy} style={{ marginTop: 8 }}>
                Entregar regalo de cumple
              </button>
            )}
          </div>
        </div>
      )}
      {card.insights?.length > 0 && (
        <ul className="client-insights">
          {card.insights.map((i) => (
            <li key={i.kind} className={`insight-${i.kind}`}>{i.text}</li>
          ))}
        </ul>
      )}
      <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={busy}>
        Cancelar
      </button>
    </>
  )
}

// "Cliente desde marzo 2026 · ~24 visitas · última hace 3 días"
function ClientFactsLine({ card }: { card: ScannedCard }) {
  if (card.since === undefined) return null
  const parts: string[] = []
  if (card.since) parts.push(`Cliente desde ${new Date(card.since).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`)
  if (card.visits > 0) parts.push(`${card.visits} ${card.visits === 1 ? 'visita' : 'visitas'}`)
  if (card.visits > 0 && card.lastVisitDays !== null) {
    parts.push(card.lastVisitDays === 0 ? 'última hoy' : card.lastVisitDays === 1 ? 'última ayer' : `última hace ${card.lastVisitDays} días`)
  }
  return parts.length ? <p className="help client-facts">{parts.join(' · ')}</p> : null
}

function ManualEntry({ onSubmit, onCancel }: { onSubmit: (code: string) => void; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, '')

  return (
    <div className="scrim" onClick={onCancel}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        onSubmit={(e) => {
          e.preventDefault()
          if (clean.length !== 4 && clean.length !== 12) {
            setError(true)
            return
          }
          onSubmit(clean)
        }}
        noValidate
      >
        <h3 id="manual-title">Tipear código</h3>
        <p style={{ margin: 0, color: 'var(--text-soft)' }}>Son los 4 caracteres que están debajo del QR de la tarjeta.</p>
        <input
          className="input pin-input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setError(false)
          }}
          maxLength={14}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Código de la tarjeta"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'manual-error' : undefined}
          autoFocus
        />
        {error && (
          <p className="help help-error" id="manual-error" style={{ margin: 0 }}>
            Escribí los 4 caracteres de debajo del QR.
          </p>
        )}
        <div className="dialog-actions">
          <button className="btn" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit">
            Buscar
          </button>
        </div>
      </form>
    </div>
  )
}
