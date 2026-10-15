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
import { autoTextColor } from '../lib/color'
import {
  loadToken,
  saveToken,
  scannerError,
  scannerLogin,
  scannerLookup,
  scannerSession,
  scannerStamp,
  type ScannedCard,
  type ScannerBusiness,
} from '../lib/scanner'

type Phase =
  | { kind: 'loading' }
  | { kind: 'pin'; message?: string }
  | { kind: 'blocked'; reason: 'subscription' | 'no-card' | 'not-found' }
  | { kind: 'ready'; token: string; business: ScannerBusiness }

export default function Scanner() {
  const { businessId = '' } = useParams()
  const [phase, setPhase] = useState<Phase>(() => (loadToken(businessId) ? { kind: 'loading' } : { kind: 'pin' }))

  const handleSessionError = useCallback(
    (err: unknown) => {
      const e = scannerError(err)
      if (e.reason === 'session') {
        saveToken(businessId, null)
        setPhase({ kind: 'pin', message: 'La sesión del escáner se cerró (puede que hayan cambiado el PIN). Entrá de nuevo.' })
        return true
      }
      if (e.reason === 'subscription' || e.reason === 'no-card') {
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
      />
    )
  }
  if (phase.kind === 'blocked') {
    return (
      <main>
        {phase.reason === 'subscription' ? (
          <EmptyState illustration="expired" title="El escáner está en pausa">
            La suscripción del local no está al día. Cuando se regularice, el escáner vuelve a funcionar solo.
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
}: {
  businessId: string
  message?: string
  onLogin: (token: string, business: ScannerBusiness) => void
  onNotFound: () => void
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
    <main style={{ maxWidth: 400 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Mascot size={96} />
      </div>
      <h2 style={{ marginTop: 16, textAlign: 'center' }}>Escáner del local</h2>
      <p style={{ textAlign: 'center', color: 'var(--text-soft)', marginTop: 8 }}>Ingresá el PIN del negocio.</p>
      <form className="card" onSubmit={handleSubmit} noValidate style={{ gap: 16, marginTop: 24 }}>
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
    </main>
  )
}

// ---------- Cámara y resultado ----------

type View =
  | { kind: 'scanning' }
  | { kind: 'searching' }
  | { kind: 'choose'; cards: ScannedCard[] }
  | { kind: 'card'; card: ScannedCard; cooldown?: number }
  | { kind: 'done'; card: ScannedCard; action: 'add' | 'redeem' }
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
  const scannerRef = useRef<QrScanner | null>(null)
  const [view, setView] = useState<View>({ kind: 'scanning' })
  const [cameraError, setCameraError] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const scanning = view.kind === 'scanning' && !manualOpen

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

  // La cámara corre solo mientras se está escaneando.
  useEffect(() => {
    if (!scanning || !videoRef.current) return
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
    scannerRef.current = scanner
    scanner
      .start()
      .then(() => setCameraError(false))
      .catch(() => setCameraError(true))
    return () => {
      scanner.stop()
      scanner.destroy()
      scannerRef.current = null
    }
  }, [scanning, lookup])

  async function act(card: ScannedCard, action: 'add' | 'redeem', force = false) {
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
      else setView({ kind: 'error', message: 'No pudimos guardar el sello. Revisá tu conexión e intentá de nuevo.' })
    } finally {
      setBusy(false)
    }
  }

  // Después de sumar o canjear, vuelve solo a la cámara.
  useEffect(() => {
    if (view.kind !== 'done') return
    const t = setTimeout(() => setView({ kind: 'scanning' }), 3000)
    return () => clearTimeout(t)
  }, [view])

  const bg = business.design.bgColor ?? DEFAULT_CARD.bgColor
  const back = () => setView({ kind: 'scanning' })

  return (
    <div className="scanner">
      <header className="scanner-header">
        <strong>{business.name}</strong>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onLogout}>
          Salir
        </button>
      </header>

      <div className="scanner-camera">
        <video ref={videoRef} muted playsInline aria-label="Cámara para escanear la tarjeta" />
        {scanning && !cameraError && <div className="scanner-frame" aria-hidden="true" />}
        {scanning && cameraError && (
          <div className="scanner-camera-msg" role="alert">
            <p>No pudimos abrir la cámara. Dale permiso en el navegador o tipeá el código de la tarjeta.</p>
          </div>
        )}
        {scanning && !cameraError && <p className="scanner-hint">Apuntá al QR de la tarjeta del cliente</p>}
      </div>

      <div className="scanner-bottom">
        <button className="btn btn-lg" type="button" onClick={() => setManualOpen(true)} disabled={!scanning}>
          Tipear código
        </button>
      </div>

      {view.kind !== 'scanning' && (
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
              <button className="btn btn-lg btn-primary" type="button" onClick={back}>
                Escanear otra
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
              <button className="btn btn-ghost" type="button" onClick={back}>
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
              onRedeem={() => act(view.card, 'redeem')}
              onCancel={back}
            />
          )}

          {view.kind === 'done' && (
            <div className="scanner-center" role="status" style={{ flexDirection: 'column' }}>
              {view.action === 'redeem' ? (
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
              <button className="btn btn-lg btn-primary" type="button" onClick={back} style={{ marginTop: 12 }}>
                Escanear otra
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

function CardResult({
  card,
  business,
  bg,
  cooldown,
  busy,
  onAdd,
  onRedeem,
  onCancel,
}: {
  card: ScannedCard
  business: ScannerBusiness
  bg: string
  cooldown?: number
  busy: boolean
  onAdd: (force: boolean) => void
  onRedeem: () => void
  onCancel: () => void
}) {
  const ready = card.stamps >= card.total
  return (
    <>
      <h3>{card.name ?? 'Cliente'}</h3>
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
      <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={busy}>
        Cancelar
      </button>
    </>
  )
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
