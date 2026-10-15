// Firma del estudio que hizo el producto (pie de la landing y del login).
export const STUDIO = { name: 'Studio Five', url: 'https://studiofive.app' }

// Tarjeta de ejemplo de la landing: negocio de demo "Sellito" con código de alta fijo.
export const DEMO_ENROLL_CODE = 'prueba'

// Video de la landing ("Miralo en acción"). Se muestra solo si el archivo existe en web/public.
// Dos calidades: 1080p para compu y 720p para celular (pesa la mitad y carga rápido con datos).
export const DEMO_VIDEO = {
  src: '/video/sellito-demo-v2.mp4',
  srcMobile: '/video/sellito-demo-720-v2.mp4',
  poster: '/video/sellito-demo.jpg',
}
