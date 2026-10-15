import { FirebaseError } from 'firebase/app'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from './firebase'

// Mismos límites que storage.rules.
const MAX_BYTES = 2 * 1024 * 1024
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export function imageFileError(file: File): string | null {
  if (!EXTENSIONS[file.type]) return 'Usá una imagen PNG, JPG o WebP.'
  if (file.size >= MAX_BYTES) return 'La imagen pesa más de 2 MB. Probá con una más liviana.'
  return null
}

// Mensaje que dice qué hacer; el código va al final para poder diagnosticar.
export function uploadErrorMessage(err: unknown): string {
  console.error('Error al subir imagen:', err)
  const code = err instanceof FirebaseError ? err.code : 'desconocido'
  const message = (() => {
    switch (code) {
      case 'storage/unauthorized':
        return 'No tenés permiso para subir imágenes a este negocio. Si el problema sigue, avisanos.'
      case 'storage/unauthenticated':
        return 'Tu sesión se cerró. Volvé a iniciar sesión y probá de nuevo.'
      case 'storage/retry-limit-exceeded':
        return 'La subida tardó demasiado. Revisá tu conexión e intentá de nuevo.'
      case 'storage/quota-exceeded':
        return 'Se llenó el espacio de imágenes. Avisanos para resolverlo.'
      case 'storage/canceled':
        return 'Se canceló la subida.'
      default:
        return 'No pudimos subir la imagen. Intentá de nuevo.'
    }
  })()
  return `${message} (código: ${code})`
}

// Nombre nuevo en cada subida: los Wallets cachean las imágenes por URL (SELLITO_SPEC.md §12).
export async function uploadBusinessImage(businessId: string, kind: 'logo' | 'banner' | 'stamp', file: File) {
  const path = `businesses/${businessId}/public/${kind}-${Date.now()}.${EXTENSIONS[file.type]}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file, { contentType: file.type, cacheControl: 'public, max-age=31536000' })
  return getDownloadURL(fileRef)
}
