import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Manifest del escáner instalable (PWA). Se genera con VITE_APP_NAME para no escribir el nombre a mano.
// Se sirve en /escaner/{local}/manifest.webmanifest (rewrite en firebase.json) y start_url/scope son
// relativos ("./"), así el acceso directo abre el escáner de ESE local. En iPhone la app instalada no
// comparte almacenamiento con Safari, así que no puede depender de lo guardado.
function scannerManifest(appName: string): Plugin {
  const manifest = JSON.stringify(
    {
      name: `${appName} · Escáner`,
      short_name: 'Escáner',
      description: `Sumá sellos y canjeá premios con ${appName}.`,
      lang: 'es-AR',
      start_url: './',
      scope: './',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#FFF4E0',
      theme_color: '#12372A',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  )
  return {
    name: 'scanner-manifest',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (path !== '/escaner.webmanifest' && !/^\/escaner\/[^/]+\/manifest\.webmanifest$/.test(path)) return next()
        res.setHeader('Content-Type', 'application/manifest+json')
        res.end(manifest)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'escaner.webmanifest', source: manifest })
    },
  }
}

// robots.txt y sitemap.xml con VITE_SITE_URL (las direcciones nunca se escriben a mano).
// La app (panel, escáner, altas) no se indexa: lo marca src/lib/seo.ts con <meta name="robots">.
function seoFiles(siteUrl: string): Plugin {
  const site = siteUrl.replace(/\/+$/, '')
  const robots = `User-agent: *\nAllow: /\nDisallow: /panel\nDisallow: /admin\nDisallow: /escaner\nDisallow: /c/\n\nSitemap: ${site}/sitemap.xml\n`
  const pages = ['/', '/privacidad', '/terminos', '/soporte']
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.map((p) => `  <url><loc>${site}${p}</loc></url>`).join('\n') +
    `\n</urlset>\n`
  return {
    name: 'seo-files',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [react(), scannerManifest(env.VITE_APP_NAME || 'Sellito'), seoFiles(env.VITE_SITE_URL || '')],
  }
})
