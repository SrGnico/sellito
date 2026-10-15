import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Manifest del escáner instalable (PWA). Se genera con VITE_APP_NAME para no escribir el nombre a mano.
// Abre /escaner, que redirige al escáner del último local usado en ese celular.
function scannerManifest(appName: string): Plugin {
  const manifest = JSON.stringify(
    {
      name: `${appName} · Escáner`,
      short_name: 'Escáner',
      description: `Sumá sellos y canjeá premios con ${appName}.`,
      lang: 'es-AR',
      start_url: '/escaner',
      scope: '/escaner',
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
      server.middlewares.use('/escaner.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json')
        res.end(manifest)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'escaner.webmanifest', source: manifest })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [react(), scannerManifest(env.VITE_APP_NAME || 'Sellito')],
  }
})
