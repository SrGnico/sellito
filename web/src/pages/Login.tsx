import { FirebaseError } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authErrorMessage, useAuth } from '../lib/auth'
import { auth } from '../lib/firebase'
import Mascot from '../components/Mascot'
import Spinner from '../components/Spinner'
import { STUDIO } from '../content/brand'
import { APP_NAME, SITE_URL } from '../lib/urls'

type Mode = 'login' | 'signup'

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
      }
    } catch (err) {
      setError(authErrorMessage(err instanceof FirebaseError ? err.code : ''))
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
      <p className="help" style={{ marginTop: 32, textAlign: 'center' }}>
        <a href={SITE_URL}>{APP_NAME}</a> · Diseñado y desarrollado por{' '}
        <a href={STUDIO.url} target="_blank" rel="noopener">{STUDIO.name}</a>
      </p>
    </main>
  )
}
