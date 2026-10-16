import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useState } from 'react'
import { toast } from '../lib/feedback'
import { db } from '../lib/firebase'
import type { Business } from '../lib/types'
import Spinner from './Spinner'

// "Ya lo imprimí": cierra el paso del QR en los primeros pasos y deja claro que el QR va impreso a la
// vista. (El paso también se da por hecho solo cuando se suma el primer cliente.)
export default function QrPrintedButton({ business, small = false }: { business: Business; small?: boolean }) {
  const [busy, setBusy] = useState(false)
  if (business.qrPrintedAt) return null

  async function mark() {
    setBusy(true)
    try {
      await updateDoc(doc(db, 'businesses', business.id), { qrPrintedAt: serverTimestamp(), updatedAt: serverTimestamp() })
      toast('¡Listo! Ahora tus clientes ya pueden escanearlo.')
    } catch {
      toast('No pudimos guardarlo. Revisá tu conexión.', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button className={small ? 'btn btn-sm btn-primary' : 'btn btn-primary'} type="button" onClick={mark} disabled={busy} aria-busy={busy}>
      {busy && <Spinner small />}
      Ya lo imprimí
    </button>
  )
}
