import { isSiteHost } from './urls'

// Solo el sitio público (landing y páginas legales en SITE_URL) se indexa. El panel, el escáner y las
// altas de clientes (que también viven en el dominio público, en /c/…) llevan noindex.
const PUBLIC_PATHS = ['/', '/privacidad', '/terminos', '/soporte']

export function updateRobots(pathname: string) {
  const indexable = isSiteHost() && PUBLIC_PATHS.includes(pathname.replace(/\/+$/, '') || '/')
  let tag = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (!tag) {
    tag = document.createElement('meta')
    tag.name = 'robots'
    document.head.appendChild(tag)
  }
  tag.content = indexable ? 'index, follow' : 'noindex, nofollow'
}
