import { SITE_URL } from './urls'

// De qué campaña llegó cada negocio. La landing (misellito.com.ar) lee utm_* y fbclid de la URL y los
// guarda en una cookie del dominio principal (.misellito.com.ar) por 30 días, así siguen ahí cuando la
// persona pasa a crear su cuenta en app.misellito.com.ar. Al crear el negocio se copian a su documento
// (campo `attribution`) y los usa la API de Conversiones de Meta al confirmarse el pago.

const COOKIE = 'sellito_attr'
const DAYS = 30
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'] as const

export type Attribution = Partial<Record<(typeof PARAMS)[number] | 'fbc' | 'fbp' | 'landing' | 'ua', string>>

// ".misellito.com.ar" en producción; en localhost, sin dominio (la cookie queda en el host).
function cookieDomain(): string {
  try {
    const host = new URL(SITE_URL).hostname
    const here = window.location.hostname
    const local = host === 'localhost' || /^[\d.]+$/.test(host)
    const sameSite = here === host || here.endsWith(`.${host}`)
    return local || !sameSite ? '' : `; domain=.${host}`
  } catch {
    return ''
  }
}

export function setCookie(name: string, value: string, days: number) {
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${days * 86400}; path=/; samesite=lax${cookieDomain()}${secure}`
}

export function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

const clean = (v: string) => v.trim().slice(0, 200)

// Si la URL trae parámetros de campaña, reemplazan a los guardados (último anuncio que trajo a la persona).
export function captureAttribution() {
  const q = new URLSearchParams(window.location.search)
  const found: Attribution = {}
  for (const p of PARAMS) {
    const v = q.get(p)
    if (v) found[p] = clean(v)
  }
  if (Object.keys(found).length === 0) return
  if (found.fbclid) found.fbc = `fb.1.${Date.now()}.${found.fbclid}`
  found.landing = clean(window.location.pathname)
  try {
    setCookie(COOKIE, JSON.stringify(found), DAYS)
  } catch {
    // sin cookies: no se guarda el origen, nada más
  }
}

// Lo guardado + las cookies de Meta (_fbp/_fbc) + el navegador (la API de Conversiones lo pide).
export function readAttribution(): Attribution {
  let saved: Attribution = {}
  try {
    saved = JSON.parse(getCookie(COOKIE) ?? '{}') as Attribution
  } catch {
    saved = {}
  }
  const fbp = getCookie('_fbp')
  const fbc = getCookie('_fbc') ?? saved.fbc
  return { ...saved, ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}), ua: navigator.userAgent.slice(0, 300) }
}
