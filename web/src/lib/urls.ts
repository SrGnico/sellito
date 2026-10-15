// Direcciones públicas de Sellito (web/.env.local). Nunca escribirlas a mano en el código:
// cuando se conecte misellito.com.ar solo cambian estas variables.
//   VITE_SITE_URL → landing y links de alta (SITE_URL/c/{código}, el del QR)
//   VITE_APP_URL  → panel de los negocios y escáner
//   VITE_API_URL  → Cloud Functions
const env = import.meta.env

// Nombre de la app (VITE_APP_NAME). Igual que las direcciones: nunca escrito a mano.
export const APP_NAME = env.VITE_APP_NAME || 'Sellito'

const trim = (url: string | undefined) => url?.replace(/\/+$/, '') || undefined

export const SITE_URL = trim(env.VITE_SITE_URL) ?? window.location.origin
export const APP_URL = trim(env.VITE_APP_URL) ?? window.location.origin
export const API_URL = trim(env.VITE_API_URL)

export function enrollUrl(code: string): string {
  return `${SITE_URL}/c/${code}`
}

// Las direcciones provisorias de Firebase (o localhost) sirven para probar, pero no para imprimir.
export function isProvisionalUrl(url: string): boolean {
  const host = new URL(url).hostname
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')
}

// ¿Estamos en el dominio público (landing) y no en el de la app? Mismo build para los dos dominios.
export function isSiteHost(): boolean {
  const site = new URL(SITE_URL).host
  return window.location.host === site && site !== new URL(APP_URL).host
}
