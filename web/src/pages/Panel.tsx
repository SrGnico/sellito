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
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import CardPreview from '../components/CardPreview'
import EnrollQr from '../components/EnrollQr'
import { cardConfigFrom } from '../lib/cardDesign'
import { useAuth } from '../lib/auth'
import { auth, db } from '../lib/firebase'
import type { Business } from '../lib/types'
import CardEditor from './CardEditor'
import Customers from './Customers'
import SubscriptionBanner from '../components/SubscriptionBanner'
import { accessLevel, isReadOnly } from '../lib/subscription'
import '../styles/panel.css'
import EmptyState from '../components/EmptyState'
import LoadingScreen from '../components/LoadingScreen'
import Mascot from '../components/Mascot'
import Onboarding from '../components/Onboarding'
import ScannerSettings from '../components/ScannerSettings'
import Spinner from '../components/Spinner'
import TestCards from '../components/TestCards'
import { APP_NAME } from '../lib/urls'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; businesses: Business[] }

export default function Panel() {
  const { user } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [onboarded, setOnboarded] = useState(false)

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
          <NavLink to="/panel/tarjeta">Tarjeta</NavLink>
        </nav>
      )}

      <main className="main-wide">
        {state.status === 'ready' && state.businesses[0] && <SubscriptionBanner business={state.businesses[0]} />}
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
            <Route index element={<BusinessHome business={state.businesses[0]} />} />
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
          </Routes>
        )}
      </main>
    </>
  )
}

function CreateBusiness({ uid }: { uid: string }) {
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

function BusinessHome({ business }: { business: Business }) {
  const designed = Boolean(business.rule)
  const readOnly = isReadOnly(accessLevel(business.subscription))
  return (
    <>
      <h2>{business.name}</h2>
      {!designed && (
        <div className="alert alert-info" role="status" style={{ marginTop: 24 }}>
          <div>
            <span className="alert-title">Tu negocio está creado</span>
            <span className="alert-text">El próximo paso es diseñar tu tarjeta de sellos.</span>
          </div>
        </div>
      )}
      <div className="home-grid">
        <div style={{ maxWidth: 360 }}>
          <CardPreview config={cardConfigFrom(business)} filled={designed ? 2 : 0} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <div className="card">
            <h4>{designed ? 'Tu tarjeta' : 'Diseñá tu tarjeta'}</h4>
            <p style={{ margin: 0, color: 'var(--text-soft)' }}>
              Logo, colores, ícono del sello y cuántos sellos hacen falta para el premio.
            </p>
            <Link className="btn btn-primary" to="tarjeta" style={{ alignSelf: 'flex-start', marginTop: 8 }}>
              {readOnly ? 'Ver tarjeta' : designed ? 'Editar tarjeta' : 'Diseñar tarjeta'}
            </Link>
          </div>
          {designed && (
            <div className="card">
              <h4>Tus clientes</h4>
              <p style={{ margin: 0, color: 'var(--text-soft)' }}>
                Quiénes tienen tu tarjeta, cuántos sellos llevan y a quién escribirle.
              </p>
              <Link className="btn" to="clientes" style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                Ver clientes
              </Link>
            </div>
          )}
          <EnrollQr business={business} />
          {business.rule && <ScannerSettings business={business} readOnly={readOnly} />}
          {import.meta.env.DEV && business.rule && !readOnly && <TestCards business={business} />}
        </div>
      </div>
    </>
  )
}
