import { collection, getCountFromServer, limit, onSnapshot, orderBy, query, where, type Timestamp } from 'firebase/firestore'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Spinner from '../components/Spinner'
import { callable, db } from '../lib/firebase'
import { scannerError } from '../lib/scanner'
import { accessLevel, canOperate } from '../lib/subscription'
import type { Business } from '../lib/types'
import { confirmar, toast } from '../lib/feedback'

// Panel → Avisos: mensajes del negocio que llegan como notificación a la tarjeta del Wallet de sus
// clientes. Solo a quienes aceptaron recibir novedades. Ver functions/src/notices/index.ts.
const TITLE_MAX = 40
const BODY_MAX = 140

const sendNotice = callable<{ businessId: string; title: string; body: string }, { id: string }>('sendNotice')

type Notice = {
  id: string
  title: string
  body: string
  status: 'sending' | 'sent'
  createdAt: Timestamp | null
  counts?: { recipients: number; notified: number; failed: number }
}

export default function Notices({ business }: { business: Business }) {
  const [audience, setAudience] = useState<number | null>(null)
  const [history, setHistory] = useState<Notice[] | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const active = canOperate(accessLevel(business.subscription))

  useEffect(() => {
    getCountFromServer(query(collection(db, 'businesses', business.id, 'cards'), where('consent.marketing', '==', true)))
      .then((r) => setAudience(r.data().count))
      .catch(() => setAudience(null))
    return onSnapshot(
      query(collection(db, 'businesses', business.id, 'notices'), orderBy('createdAt', 'desc'), limit(20)),
      (snap) => setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notice)),
      () => setHistory([]),
    )
  }, [business.id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return setError('Escribí un título y un mensaje.')
    const ok = await confirmar({
      title: `¿Mandar el aviso a ${audience ?? 0} ${audience === 1 ? 'cliente' : 'clientes'}?`,
      text: 'Llega como notificación al celular y no se puede deshacer. Podés mandar uno por día.',
      confirmLabel: 'Enviar aviso',
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    setSent(false)
    try {
      await sendNotice({ businessId: business.id, title: title.trim(), body: body.trim() })
      toast('¡Aviso enviado!')
      setTitle('')
      setBody('')
      setSent(true)
    } catch (err) {
      const e = scannerError(err)
      setError(
        e.reason === 'rate-limit'
          ? 'Ya mandaste un aviso hoy. Podés mandar uno por día: guardalo para mañana.'
          : e.reason === 'subscription'
            ? 'Para mandar avisos necesitás la suscripción activa.'
            : 'No pudimos enviar el aviso. Intentá de nuevo.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="section-page">
      <h2>Avisos a tus clientes</h2>
      <p className="section-intro">
        Mandá una novedad y le llega como notificación al celular a quienes tienen tu tarjeta: una promo, un día de doble sello,
        un producto nuevo. Sin WhatsApp ni mails.
      </p>
      <p className="help" style={{ marginTop: 0 }}>
        Los saludos de cumpleaños salen solos y no cuentan para el límite de un aviso por día. Se configuran en{' '}
        <Link to="/panel/tarjeta">Tarjeta → Regalo de cumpleaños</Link>.
      </p>

      <div className="alert alert-info" role="status">
        <div>
          <span className="alert-title">
            {audience === null ? 'Calculando a quiénes les llega…' : `Le llega a ${audience} ${audience === 1 ? 'cliente' : 'clientes'}`}
          </span>
          <span className="alert-text">
            Solo a quienes aceptaron recibir novedades al sumarse, como pide la ley de datos personales. Podés mandar un aviso por
            día: usalo para cosas que valgan la pena, así no lo silencian.
          </span>
        </div>
      </div>

      {!active ? (
        <div className="alert alert-warn" role="alert">
          <span className="alert-text">Para mandar avisos necesitás la suscripción activa. <Link to="/panel">Activala desde el inicio</Link>.</span>
        </div>
      ) : (
        <form className="card" onSubmit={handleSubmit} noValidate style={{ gap: 14 }}>
          {error && (
            <div className="alert alert-err" role="alert">
              <span className="alert-text">{error}</span>
            </div>
          )}
          {sent && (
            <div className="alert alert-ok" role="status">
              <span className="alert-text">¡Enviado! En unos minutos llega a los celulares. Abajo ves el resultado.</span>
            </div>
          )}
          <div>
            <label className="label" htmlFor="notice-title">Título</label>
            <input id="notice-title" className="input" maxLength={TITLE_MAX} placeholder="Ej.: ¡Doble sello este sábado!" value={title}
              onChange={(e) => setTitle(e.target.value)} />
            <p className="help">{title.length}/{TITLE_MAX}</p>
          </div>
          <div>
            <label className="label" htmlFor="notice-body">Mensaje</label>
            <textarea id="notice-body" className="textarea" maxLength={BODY_MAX} rows={3}
              placeholder="Ej.: Este sábado cada café suma 2 sellos. ¡Te esperamos!" value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="help">{body.length}/{BODY_MAX}</p>
          </div>
          {(title.trim() || body.trim()) && (
            <div className="lockscreen-preview" aria-label="Así llega al celular">
              <span className="lockscreen-icon" aria-hidden="true" style={{ background: business.design?.bgColor ?? '#FF9EC4' }} />
              <div>
                <strong>{title.trim() || business.name}</strong>
                <span>{body.trim()}</span>
              </div>
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy || audience === 0} aria-busy={busy} style={{ alignSelf: 'flex-start' }}>
            {busy && <Spinner small />}
            {busy ? 'Enviando…' : 'Enviar aviso'}
          </button>
          {audience === 0 && <p className="help" style={{ margin: 0 }}>Todavía nadie aceptó recibir novedades.</p>}
        </form>
      )}

      <section className="card" aria-labelledby="notices-history" style={{ gap: 10 }}>
        <h4 id="notices-history">Enviados</h4>
        {history === null ? (
          <span className="skeleton" style={{ height: 20 }} />
        ) : history.length === 0 ? (
          <p className="help" style={{ margin: 0 }}>Todavía no mandaste avisos.</p>
        ) : (
          <ul className="activity">
            {history.map((n) => (
              <li key={n.id} style={{ alignItems: 'flex-start' }}>
                <span className="activity-text" style={{ whiteSpace: 'normal' }}>
                  <strong>{n.title}</strong> — {n.body}
                </span>
                <span className="activity-time">
                  {n.status === 'sending'
                    ? 'Enviando…'
                    : `${n.counts?.recipients ?? 0} ${n.counts?.recipients === 1 ? 'cliente' : 'clientes'}`}
                  {n.createdAt && ` · ${n.createdAt.toDate().toLocaleDateString('es-AR')}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
