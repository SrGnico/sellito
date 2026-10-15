import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { callable, db } from '../lib/firebase'
import type { Business } from '../lib/types'
import Spinner from './Spinner'

// SOLO EN DESARROLLO (`npm run dev`): para probar que una tarjeta ya agregada al Wallet se
// actualiza sola. El escáner real (paso 5) reemplaza esto.
type Card = { id: string; customer: { name?: string }; stamps: number; barcodeValue: string; googleObjectId?: string }

const testSetStamps = callable<{ businessId: string; cardId: string; stamps: number }, { stamps: number }>('testSetStamps')
const resyncCards = callable<{ businessId: string }, { updated: number; failed: number }>('resyncCards')

export default function TestCards({ business }: { business: Business }) {
  const [cards, setCards] = useState<Card[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const total = business.rule?.stampsRequired ?? 0

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'businesses', business.id, 'cards'), orderBy('createdAt', 'desc')), (snap) =>
        setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Card)),
      ),
    [business.id],
  )

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key)
    setMessage(null)
    try {
      setMessage(await fn())
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const setStamps = (card: Card, stamps: number) =>
    run(card.id + stamps, async () => {
      await testSetStamps({ businessId: business.id, cardId: card.id, stamps })
      return `${card.customer.name ?? card.id}: ${stamps} de ${total}. Abrí el Wallet para ver el cambio.`
    })

  return (
    <section className="card" style={{ gap: 12, borderStyle: 'dashed' }}>
      <h4>Prueba de tarjetas (solo en desarrollo)</h4>
      <p className="help" style={{ margin: 0 }}>
        Cambia el contador y actualiza el Wallet, como lo va a hacer el escáner.
      </p>
      <button
        className="btn btn-sm"
        type="button"
        style={{ alignSelf: 'flex-start' }}
        disabled={busy !== null}
        aria-busy={busy === 'resync'}
        onClick={() =>
          run('resync', async () => {
            const r = (await resyncCards({ businessId: business.id })).data
            return `Tarjetas actualizadas: ${r.updated}. Con error: ${r.failed}.`
          })
        }
      >
        {busy === 'resync' && <Spinner small />}
        Actualizar todas las tarjetas
      </button>
      {message && <p role="status" className="help" style={{ margin: 0 }}>{message}</p>}
      {cards.length === 0 && <p className="help" style={{ margin: 0 }}>Todavía no hay tarjetas.</p>}
      {cards.map((card) => (
        <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTop: '2px solid var(--cream-deep)', paddingTop: 12 }}>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <strong>{card.customer.name ?? 'Sin nombre'}</strong>
            <div className="help" style={{ margin: 0 }}>
              {card.barcodeValue.startsWith('S1.') ? 'código viejo (tocá "Actualizar todas")' : card.barcodeValue} ·{' '}
              {card.googleObjectId ? 'en Google' : 'sin Wallet'}
            </div>
          </div>
          <span style={{ fontWeight: 600, minWidth: 56 }}>{card.stamps} de {total}</span>
          <button className="btn btn-sm" type="button" disabled={busy !== null || card.stamps <= 0} onClick={() => setStamps(card, card.stamps - 1)} aria-label="Restar un sello">
            −1
          </button>
          <button className="btn btn-sm btn-secondary" type="button" disabled={busy !== null || card.stamps >= total} onClick={() => setStamps(card, card.stamps + 1)} aria-label="Sumar un sello">
            {busy === card.id + (card.stamps + 1) ? <Spinner small /> : '+1'}
          </button>
          <button className="btn btn-ghost btn-sm" type="button" disabled={busy !== null || card.stamps === 0} onClick={() => setStamps(card, 0)}>
            Reiniciar
          </button>
        </div>
      ))}
    </section>
  )
}
