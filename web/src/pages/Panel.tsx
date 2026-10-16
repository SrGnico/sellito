import { pixelEvent } from '../lib/metaPixel'
import { readAttribution } from '../lib/attribution'
import { signOut } from 'firebase/auth'
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import EnrollPoster from '../components/EnrollPoster'
import EnrollQr from '../components/EnrollQr'
import QrPrintedButton from '../components/QrPrinted'
import { useAuth } from '../lib/auth'
import { auth, db } from '../lib/firebase'
import type { Business } from '../lib/types'
import Customers from './Customers'
import Notices from './Notices'
import PanelHome from './PanelHome'
import Preview from './Preview'
import SetupWizard from './SetupWizard'
import SubscriptionBanner from '../components/SubscriptionBanner'
import { accessLevel, isDraft, isReadOnly } from '../lib/subscription'
import '../styles/panel.css'
import EmptyState from '../components/EmptyState'
import LoadingScreen from '../components/LoadingScreen'
import Mascot from '../components/Mascot'
import Onboarding from '../components/Onboarding'
import ScannerSettings from '../components/ScannerSettings'
import Spinner from '../components/Spinner'
import { clearSignupPrefill, readSignupPrefill } from '../lib/prefill'
import { toast } from '../lib/feedback'
import { track } from '../lib/track'
import { APP_NAME } from '../lib/urls'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; businesses: Business[] }

export default function Panel() {
  const { user } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [onboarded, setOnboarded] = useState(false)
  useSubscribeEvent(state.status === 'ready' ? state.businesses[0] : undefined)
  // En el asistente el aviso de suscripción distrae (y dice que la tarjeta ya está lista).
  const { pathname } = useLocation()
  const inWizard = pathname.startsWith('/panel/configurar') || pathname.startsWith('/panel/tarjeta')
  const inPreview = pathname.startsWith('/panel/vista-previa') // ya tiene su propio botón de activar

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'businesses'), where('ownerUid', '==', user.uid))
    return onSnapshot(
      q,
      (snap) =>
        setState({
          status: 'ready',
          businesses: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Business),
        }),
      () => setState({ status: 'error' }),
    )
  }, [user])

  return (
    <>
      <header className="panel-header">
        <Link to="/panel" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <Mascot size={32} />
          <h4>{APP_NAME}</h4>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-soft)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email}
          </span>
          <button className="btn btn-sm" type="button" onClick={() => signOut(auth)}>
            Salir
          </button>
        </div>
      </header>
      {state.status === 'ready' && state.businesses[0] && (
        <nav className="panel-nav" aria-label="Secciones del panel">
          <NavLink to="/panel" end>Inicio</NavLink>
          {isDraft(state.businesses[0]) && <NavLink to="/panel/vista-previa">Activar</NavLink>}
          <NavLink to="/panel/clientes">Clientes</NavLink>
          <NavLink to="/panel/avisos">Avisos</NavLink>
          <NavLink to="/panel/tarjeta">Tarjeta</NavLink>
          <NavLink to="/panel/qr">QR</NavLink>
          <NavLink to="/panel/escaner">Escáner</NavLink>
        </nav>
      )}

      <main className="main-wide">
        {state.status === 'ready' && state.businesses[0] && !inWizard && !inPreview && <SubscriptionBanner business={state.businesses[0]} />}
        {state.status === 'loading' && <LoadingScreen label="Cargando tu negocio…" />}

        {state.status === 'error' && (
          <EmptyState
            illustration="offline"
            title="No pudimos cargar tu negocio"
            action={<button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>Reintentar</button>}
          >
            Revisá tu conexión a internet y volvé a probar.
          </EmptyState>
        )}

        {state.status === 'ready' && state.businesses.length === 0 && user && (
          onboarded ? <CreateBusiness uid={user.uid} /> : <Onboarding onDone={() => setOnboarded(true)} />
        )}

        {state.status === 'ready' && state.businesses[0] && (
          <Routes>
            <Route index element={<PanelHome business={state.businesses[0]} />} />
            <Route path="configurar" element={<SetupWizard key={state.businesses[0].id} business={state.businesses[0]} />} />
            <Route path="vista-previa" element={<Preview business={state.businesses[0]} />} />
            <Route path="qr" element={<DraftGate business={state.businesses[0]}><QrPage business={state.businesses[0]} /></DraftGate>} />
            <Route
              path="escaner"
              element={
                <DraftGate business={state.businesses[0]}>
                  <ScannerPage business={state.businesses[0]} readOnly={isReadOnly(accessLevel(state.businesses[0].subscription))} />
                </DraftGate>
              }
            />
            <Route path="tarjeta" element={<SetupWizard key={state.businesses[0].id} business={state.businesses[0]} />} />
            <Route
              path="clientes"
              element={<DraftGate business={state.businesses[0]}><Customers key={state.businesses[0].id} business={state.businesses[0]} /></DraftGate>}
            />
            <Route path="avisos" element={<Notices key={state.businesses[0].id} business={state.businesses[0]} />} />
          </Routes>
        )}
      </main>
    </>
  )
}

function CreateBusiness({ uid }: { uid: string }) {
  const navigate = useNavigate()
  const [prefill] = useState(readSignupPrefill)
  const [name, setName] = useState(prefill.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Escribí el nombre de tu negocio.')
      return
    }
    if (trimmed.length > 80) {
      setError('Usá un nombre de hasta 80 caracteres.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // El slug lo asigna una Function más adelante (SELLITO_SPEC.md §12).
      // De qué campaña llegó (utm/fbclid guardados por la landing): se guarda una sola vez, al crearlo.
      const attribution = readAttribution()
      const ref = doc(collection(db, 'businesses'))
      const write = setDoc(ref, {
        ownerUid: uid,
        name: trimmed,
        ...(prefill.color ? { design: { bgColor: prefill.color } } : {}),
        attribution: { ...attribution, at: serverTimestamp() },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      // Directo al asistente: el negocio ya aparece en el panel (copia local) antes de que el servidor
      // confirme; si se esperara, el inicio del panel se ve un instante y después salta.
      navigate('/panel/configurar')
      await write
      clearSignupPrefill()
      track('business_created')
      pixelEvent('CompleteRegistration', {}, `registration_${ref.id}`)
    } catch {
      // Si el servidor lo rechaza, la copia local se descarta y vuelve a aparecer este formulario.
      toast('No pudimos crear el negocio. Intentá de nuevo.', 'err')
      navigate('/panel')
    }
  }

  return (
    <>
      <h2>¡Hola! Armemos tu {APP_NAME}</h2>
      <p style={{ color: 'var(--text-soft)', marginTop: 8 }}>
        Empecemos por lo básico: ¿cómo se llama tu negocio?
      </p>

      <form className="card" onSubmit={handleSubmit} noValidate style={{ gap: 16, marginTop: 24 }}>
        <div>
          <label className="label" htmlFor="business-name">Nombre del negocio</label>
          <input
            id="business-name"
            className="input"
            placeholder="Ej.: Café Lola"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'business-name-error' : 'business-name-help'}
            autoFocus
          />
          {error ? (
            <p className="help help-error" id="business-name-error">{error}</p>
          ) : (
            <p className="help" id="business-name-help">Es el que van a ver tus clientes en la tarjeta. Lo podés cambiar después.</p>
          )}
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy && <Spinner small />}
          {busy ? 'Creando tu negocio…' : 'Crear mi negocio'}
        </button>
      </form>
    </>
  )
}

// QR, escáner y clientes se habilitan al activar: en borrador llevan a la vista previa con el botón de activar.
function DraftGate({ business, children }: { business: Business; children: ReactNode }) {
  return isDraft(business) ? <Navigate to="/panel/vista-previa" replace /> : children
}

// Secciones QR y Escáner: antes estaban apiladas en el inicio.
function QrPage({ business }: { business: Business }) {
  return (
    <div className="section-page">
      <h2>QR del local</h2>
      <p className="section-intro">Imprimilo y ponelo en el mostrador. Cada cliente lo escanea una vez y la tarjeta queda en su celular.</p>
      <EnrollQr business={business} />
      <EnrollPoster business={business} />
      {business.qrPrintedAt ? (
        <p className="help" style={{ margin: 0 }}>✓ Marcaste que ya lo imprimiste. Si lo cambiás de lugar o se gasta, imprimilo de nuevo: el código no cambia.</p>
      ) : (
        <section className="card" style={{ gap: 12 }}>
          <h4>¿Ya está a la vista?</h4>
          <p className="help" style={{ margin: 0 }}>Imprimilo y ponelo en el mostrador o en la caja, donde tus clientes lo vean al pagar.</p>
          <div><QrPrintedButton business={business} /></div>
        </section>
      )}
    </div>
  )
}

function ScannerPage({ business, readOnly }: { business: Business; readOnly: boolean }) {
  return (
    <div className="section-page">
      <h2>Escáner</h2>
      <p className="section-intro">Con el escáner, quien atiende suma sellos y canjea premios desde cualquier celular del local.</p>
      {business.rule ? (
        <ScannerSettings business={business} readOnly={readOnly} />
      ) : (
        <p className="help">Primero terminá de diseñar tu tarjeta.</p>
      )}
    </div>
  )
}

// Meta Pixel: "Subscribe" cuando el panel ve la suscripción recién activada. El event_id es el mismo que
// manda el servidor por la API de Conversiones (subscribe_<id de Mercado Pago>), así Meta la cuenta una vez.
function useSubscribeEvent(business: Business | undefined) {
  const sub = business?.subscription
  useEffect(() => {
    if (sub?.status !== 'active' || !sub.mpPreapprovalId) return
    const at = sub.updatedAt?.toMillis() ?? 0
    if (Date.now() - at > 86_400_000) return // pasó hace más de un día: ya no es la confirmación del pago
    const key = `sellito-subscribe:${sub.mpPreapprovalId}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      // sin almacenamiento: puede repetirse, Meta lo deduplica por event_id
    }
    pixelEvent('Subscribe', sub.amount ? { value: sub.amount, currency: sub.currency ?? 'ARS' } : {}, `subscribe_${sub.mpPreapprovalId}`)
  }, [sub?.status, sub?.mpPreapprovalId, sub?.updatedAt, sub?.amount, sub?.currency])
}
