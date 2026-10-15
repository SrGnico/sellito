import { FirebaseError } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authErrorMessage, useAuth } from '../lib/auth'
import { auth } from '../lib/firebase'
import Mascot from '../components/Mascot'
import Spinner from '../components/Spinner'
import { STUDIO } from '../content/brand'
import { track } from '../lib/track'
import { APP_NAME, SITE_URL } from '../lib/urls'

type Mode = 'login' | 'signup'

// Se prende cuando el proveedor Google está activo en Firebase Auth (VITE_GOOGLE_SIGNIN=true).
const GOOGLE_SIGNIN = import.meta.env.VITE_GOOGLE_SIGNIN === 'true'

export default function Login() {
  const { user, loading } = useAuth()
  const location = useLocation()
  // ?registro (desde la landing) abre directo en "Creá tu cuenta".
  const [mode, setMode] = useState<Mode>(() => (new URLSearchParams(location.search).has('registro') ? 'signup' : 'login'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/panel'
  if (!loading && user) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
        track('signup')
      }
    } catch (err) {
      setError(authErrorMessage(err instanceof FirebaseError ? err.code : ''))
    } finally {
      setBusy(false)
    }
  }

  // Con Google: ventana emergente; si el navegador la bloquea, redirección (vuelve solo a esta página).
  async function handleGoogle() {
    setBusy(true)
    setError(null)
    setNotice(null)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      const cred = await signInWithPopup(auth, provider)
      if (getAdditionalUserInfo(cred)?.isNewUser) track('signup')
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ''
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider).catch(() => setError(authErrorMessage(code)))
        return
      }
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setError(authErrorMessage(code))
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    setError(null)
    setNotice(null)
    if (!email.trim()) {
      setError('Escribí tu mail arriba y volvé a tocar "Olvidé mi contraseña".')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setNotice('Si hay una cuenta con ese mail, te mandamos un link para cambiar la contraseña.')
    } catch (err) {
      setError(authErrorMessage(err instanceof FirebaseError ? err.code : ''))
    }
  }

  const isLogin = mode === 'login'

  return (
    <main style={{ maxWidth: 440 }}>
      <Mascot size={96} />
      <h2 style={{ marginTop: 16 }}>{isLogin ? 'Entrá a tu panel' : 'Creá tu cuenta'}</h2>
      <p style={{ color: 'var(--text-soft)', marginTop: 8 }}>
        {isLogin ? 'Gestioná la tarjeta de fidelidad de tu negocio.' : 'Empezá a armar la tarjeta de tu negocio en minutos.'}
      </p>

      <form className="card" onSubmit={handleSubmit} noValidate style={{ gap: 16, marginTop: 24 }}>
        {GOOGLE_SIGNIN && (
          <>
            <button className="btn btn-lg btn-google" type="button" onClick={handleGoogle} disabled={busy}>
              <GoogleLogo />
              {isLogin ? 'Entrar con Google' : 'Crear cuenta con Google'}
            </button>
            <div className="or-divider" aria-hidden="true"><span>o con tu mail</span></div>
          </>
        )}
        {error && (
          <div className="alert alert-err" role="alert" id="login-error">
            <span className="alert-text">{error}</span>
          </div>
        )}
        {notice && (
          <div className="alert alert-info" role="status">
            <span className="alert-text">{notice}</span>
          </div>
        )}

        <div>
          <label className="label" htmlFor="email">Mail</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={isLogin ? undefined : 'password-help'}
            required
          />
          {!isLogin && <p className="help" id="password-help">Mínimo 6 caracteres.</p>}
        </div>

        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy && <Spinner small />}
          {busy ? (isLogin ? 'Entrando…' : 'Creando tu cuenta…') : isLogin ? 'Entrar' : 'Crear cuenta'}
        </button>

        {isLogin && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={handleReset}>
            Olvidé mi contraseña
          </button>
        )}
      </form>

      <p style={{ marginTop: 24, textAlign: 'center' }}>
        {isLogin ? '¿Todavía no tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => {
            setMode(isLogin ? 'signup' : 'login')
            setError(null)
            setNotice(null)
          }}
        >
          {isLogin ? 'Creá una' : 'Iniciá sesión'}
        </button>
      </p>
      <p className="help" style={{ marginTop: 32, display: 'block', textAlign: 'center' }}>
        <a href={SITE_URL}>{APP_NAME}</a> · Diseñado y desarrollado por{' '}
        <a href={STUDIO.url} target="_blank" rel="noopener">{STUDIO.name}</a>
      </p>
    </main>
  )
}

// Logo "G" de Google (colores oficiales) para el botón de acceso.
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
