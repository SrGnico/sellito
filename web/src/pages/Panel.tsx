import { signOut } from 'firebase/auth'
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import EnrollPoster from '../components/EnrollPoster'
import EnrollQr from '../components/EnrollQr'
import { useAuth } from '../lib/auth'
import { auth, db } from '../lib/firebase'
import type { Business } from '../lib/types'
import CardEditor from './CardEditor'
import Customers from './Customers'
import Notices from './Notices'
import PanelHome from './PanelHome'
import SetupWizard from './SetupWizard'
import SubscriptionBanner from '../components/SubscriptionBanner'
import { accessLevel, isReadOnly } from '../lib/subscription'
import '../styles/panel.css'
import EmptyState from '../components/EmptyState'
import LoadingScreen from '../components/LoadingScreen'
import Mascot from '../components/Mascot'
import Onboarding from '../components/Onboarding'
import ScannerSettings from '../components/ScannerSettings'
import Spinner from '../components/Spinner'
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
  // En el asistente el aviso de suscripción distrae (y dice que la tarjeta ya está lista).
  const inWizard = useLocation().pathname.startsWith('/panel/configurar')

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
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '2px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
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
          <NavLink to="/panel/clientes">Clientes</NavLink>
          <NavLink to="/panel/avisos">Avisos</NavLink>
          <NavLink to="/panel/tarjeta">Tarjeta</NavLink>
          <NavLink to="/panel/qr">QR</NavLink>
          <NavLink to="/panel/escaner">Escáner</NavLink>
        </nav>
      )}

      <main className="main-wide">
        {state.status === 'ready' && state.businesses[0] && !inWizard && <SubscriptionBanner business={state.businesses[0]} />}
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
            <Route path="qr" element={<QrPage business={state.businesses[0]} />} />
            <Route
              path="escaner"
              element={<ScannerPage business={state.businesses[0]} readOnly={isReadOnly(accessLevel(state.businesses[0].subscription))} />}
            />
            <Route
              path="tarjeta"
              element={
                <CardEditor
                  key={state.businesses[0].id}
                  business={state.businesses[0]}
                  readOnly={isReadOnly(accessLevel(state.businesses[0].subscription))}
                />
              }
            />
            <Route path="clientes" element={<Customers key={state.businesses[0].id} business={state.businesses[0]} />} />
            <Route path="avisos" element={<Notices key={state.businesses[0].id} business={state.businesses[0]} />} />
          </Routes>
        )}
      </main>
    </>
  )
}

function CreateBusiness({ uid }: { uid: string }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
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
      await addDoc(collection(db, 'businesses'), {
        ownerUid: uid,
        name: trimmed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      track('business_created')
      navigate('/panel/configurar')
    } catch {
      setError('No pudimos crear el negocio. Intentá de nuevo.')
      setBusy(false)
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

// Secciones QR y Escáner: antes estaban apiladas en el inicio.
function QrPage({ business }: { business: Business }) {
  return (
    <div className="section-page">
      <h2>QR del local</h2>
      <p className="section-intro">Imprimilo y ponelo en el mostrador. Cada cliente lo escanea una vez y la tarjeta queda en su celular.</p>
      <EnrollQr business={business} />
      <EnrollPoster business={business} />
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
