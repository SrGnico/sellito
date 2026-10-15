import { API_URL } from './urls'

// Analítica propia (functions/src/analytics): solo cuenta eventos por día. Sin cookies ni datos personales.
export type TrackEvent =
  | 'landing_view'
  | 'demo_view'
  | 'demo_add'
  | 'cta_click'
  | 'signup'
  | 'business_created'
  | 'wizard_done'
  | 'subscribe_click'
  | 'enroll_view'
  | 'enroll_add'

// Una vez por pestaña para las vistas, así recargar no infla los números.
const ONCE = new Set<TrackEvent>(['landing_view', 'demo_view', 'enroll_view'])

function source(): string {
  const utm = new URLSearchParams(window.location.search).get('utm_source')
  if (utm) return utm
  try {
    const ref = document.referrer ? new URL(document.referrer).hostname : ''
    return ref && ref !== window.location.hostname ? ref : 'directo'
  } catch {
    return 'directo'
  }
}

export function track(e: TrackEvent) {
  if (!API_URL || import.meta.env.DEV) return
  if (ONCE.has(e)) {
    try {
      if (sessionStorage.getItem(`t:${e}`)) return
      sessionStorage.setItem(`t:${e}`, '1')
    } catch {
      // sin almacenamiento: se cuenta igual
    }
  }
  const body = JSON.stringify({ e, s: e === 'landing_view' ? source() : undefined })
  try {
    if (navigator.sendBeacon?.(`${API_URL}/track`, new Blob([body], { type: 'text/plain' }))) return
  } catch {
    // sigue con fetch
  }
  fetch(`${API_URL}/track`, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => undefined)
}
