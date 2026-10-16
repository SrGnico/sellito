import { getCookie, setCookie } from './attribution'

// Meta Pixel (campañas pagas). Solo se carga si existe VITE_META_PIXEL_ID, nunca en las páginas de los
// clientes de cada negocio (/c/… y el escáner) y nunca si la persona eligió "No, gracias" en el aviso.
// Cada evento lleva un event_id: el mismo que manda el servidor por la API de Conversiones, para que
// Meta lo cuente una sola vez (ver functions/src/meta/capi.ts).

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID?.trim()
const CONSENT_COOKIE = 'sellito_cookies' // "ok" o "no", compartida entre misellito.com.ar y app.

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown }
declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

let loaded = false

export const pixelConfigured = () => Boolean(PIXEL_ID)
export const pixelConsent = () => getCookie(CONSENT_COOKIE) // null = todavía no respondió

// Páginas de los clientes finales de cada negocio: ahí no se mide nada para Sellito.
export const pixelAllowedPath = (path: string) => !/^\/(c|escaner)(\/|$)/.test(path)

export function setPixelConsent(ok: boolean) {
  setCookie(CONSENT_COOKIE, ok ? 'ok' : 'no', 365)
  if (!ok) window.location.reload() // saca el Pixel que ya se había cargado
}

export function loadPixel() {
  if (loaded || !PIXEL_ID || pixelConsent() === 'no') return
  loaded = true
  // Código oficial de Meta (fbevents.js), sin el PageView automático: lo mandamos por ruta.
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args)
    else n.queue.push(args)
  } as Fbq
  n.push = n
  n.loaded = true
  n.version = '2.0'
  n.queue = []
  window.fbq = window._fbq = n
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(s)
  n('set', 'autoConfig', false, PIXEL_ID) // sin eventos automáticos (clics, formularios)
  n('init', PIXEL_ID)
}

export const newEventId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

// Evento estándar con event_id (si no se pasa, uno nuevo).
export function pixelEvent(name: string, params: Record<string, unknown> = {}, eventId = newEventId(name.toLowerCase())) {
  if (!loaded || !window.fbq) return
  window.fbq('track', name, params, { eventID: eventId })
}
