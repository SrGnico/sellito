import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, httpsCallable, httpsCallableFromURL } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { API_URL } from './urls'

const env = import.meta.env

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

// App Check: las Functions públicas (alta de clientes, escáner) solo aceptan llamadas de esta web.
// En desarrollo se usa el token de depuración registrado en App Check (VITE_APPCHECK_DEBUG_TOKEN).
if (env.VITE_RECAPTCHA_SITE_KEY && env.VITE_USE_EMULATORS !== 'true') {
  if (import.meta.env.DEV && env.VITE_APPCHECK_DEBUG_TOKEN) {
    ;(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
}

// Misma región que las Cloud Functions (ver functions/src/index.ts)
export const FUNCTIONS_REGION = 'southamerica-east1'

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app, FUNCTIONS_REGION)

if (env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}

// Llama a una Function por API_URL (api.misellito.com.ar) si está configurada; si no, por la
// dirección por defecto de Firebase. Con emuladores siempre va al emulador.
export function callable<Req, Res>(name: string) {
  return API_URL && env.VITE_USE_EMULATORS !== 'true'
    ? httpsCallableFromURL<Req, Res>(functions, `${API_URL}/${name}`)
    : httpsCallable<Req, Res>(functions, name)
}
