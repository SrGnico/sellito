import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { callable, db } from './firebase'
import type { Card } from './types'

// Clientes del panel. Misma búsqueda y filtros que functions/src/customers/index.ts.

export const PAGE_SIZE = 25
export const INACTIVE_DAYS = 30
export const NEW_DAYS = 7
export const CARDS_VERSION = 3 // functions/src/cards/search.ts
const MAX_TOKEN = 15
const DAY_MS = 86400000

export type CustomerFilter = 'all' | 'reward' | 'inactive' | 'new'
export type SortKey = 'createdAt' | 'lastActivityAt' | 'stamps'
export type Sort = { key: SortKey; dir: 'asc' | 'desc' }

export const FILTERS: { id: CustomerFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'reward', label: 'Con premio disponible' },
  { id: 'inactive', label: `Inactivos hace más de ${INACTIVE_DAYS} días` },
  { id: 'new', label: 'Nuevos esta semana' },
]

export const normalizeText = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function localPhoneDigits(phone: string): string {
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('9') && d.length === 11) d = d.slice(1)
  if (d.startsWith('0')) d = d.slice(1)
  return d
}

export function searchToken(word: string): string {
  const digits = word.replace(/[\s\-().+]/g, '')
  if (/^\d+$/.test(digits)) return (digits.length >= 10 ? localPhoneDigits(digits) : digits.replace(/^0+/, '')).slice(0, MAX_TOKEN)
  return word.slice(0, MAX_TOKEN)
}

export const searchWords = (search: string) => normalizeText(search).split(/\s+/).filter(Boolean)

// Con un filtro de rango (inactivos, nuevos) el orden queda fijo en ese campo: Firestore lo exige.
export function fixedSort(filter: CustomerFilter, searching: boolean): Sort | null {
  if (searching) return null
  if (filter === 'inactive') return { key: 'lastActivityAt', dir: 'asc' }
  if (filter === 'new') return { key: 'createdAt', dir: 'desc' }
  return null
}

export type Page = { cards: Card[]; last: QueryDocumentSnapshot | null; hasMore: boolean }

export async function fetchCustomers(
  businessId: string,
  opts: { filter: CustomerFilter; search: string; sort: Sort; after: QueryDocumentSnapshot | null },
): Promise<Page> {
  const words = searchWords(opts.search)
  const sort = fixedSort(opts.filter, words.length > 0) ?? opts.sort
  const c: QueryConstraint[] = []
  // Si hay búsqueda, se ignoran los filtros (así alcanza con pocos índices).
  if (words.length > 0) c.push(where('searchTokens', 'array-contains', searchToken(words[0])))
  else if (opts.filter === 'reward') c.push(where('rewardsAvailable', '==', 1))
  else if (opts.filter === 'inactive') c.push(where('lastActivityAt', '<', Timestamp.fromMillis(Date.now() - INACTIVE_DAYS * DAY_MS)))
  else if (opts.filter === 'new') c.push(where('createdAt', '>=', Timestamp.fromMillis(Date.now() - NEW_DAYS * DAY_MS)))
  c.push(orderBy(sort.key, sort.dir))
  if (opts.after) c.push(startAfter(opts.after))
  c.push(limit(PAGE_SIZE + 1)) // uno de más para saber si hay otra página

  const snap = await getDocs(query(collection(db, 'businesses', businessId, 'cards'), ...c))
  const docs = snap.docs.slice(0, PAGE_SIZE)
  const rest = words.slice(1).map(searchToken)
  const cards = docs
    .map((d) => ({ id: d.id, ...d.data() }) as Card & { searchTokens?: string[] })
    .filter((card) => rest.every((t) => card.searchTokens?.includes(t)))
  return { cards, last: docs.at(-1) ?? null, hasMore: snap.docs.length > PAGE_SIZE }
}

export const exportCustomers = callable<
  { businessId: string; filter: CustomerFilter; search: string },
  { filename: string; csv: string; rows: number }
>('exportCustomers')

export const upgradeCards = callable<{ businessId: string }, { updated: number }>('upgradeCards')

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Link de WhatsApp (wa.me) con el teléfono en formato internacional. Asume Argentina si no
// tiene código de país; si no se puede interpretar, null (y no se muestra el botón).
export function whatsappNumber(phone: string | undefined): string | null {
  if (!phone) return null
  const intl = phone.trim().startsWith('+')
  let d = phone.replace(/\D/g, '')
  if (intl && !d.startsWith('54')) return d.length >= 8 && d.length <= 15 ? d : null
  if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('9')) d = d.slice(1)
  if (d.startsWith('0')) d = d.slice(1)
  // Celular escrito con 15 después del código de área (11 15 2345 6789): se saca el 15.
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === '15') {
        d = d.slice(0, area) + d.slice(area + 2)
        break
      }
    }
  }
  return d.length === 10 ? `549${d}` : null
}

export const formatDate = (t: Timestamp | undefined) =>
  t ? t.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

export const formatDateTime = (t: Timestamp | undefined) =>
  t ? t.toDate().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
