# Sellito: ilustraciones y assets

Estilo: formas planas, contorno verde bosque de 3 a 4 px, sombra dura en verde, y solo los colores de la marca (rosa `#FF9EC4`, verde `#12372A`, crema `#FFF4E0`, más rosa suave `#FFD3E4` y campo `#FFFBF3`). Cada archivo trae su `viewBox`, así que escala sin perder calidad.

| Archivo | Tamaño base | Dónde se usa |
|---|---|---|
| `mascot.svg` | 200 × 200 | Logo y mascota. Por debajo de 40 px usar `favicon.svg` (sin borde punteado) |
| `favicon.svg` | 64 × 64 | Favicon, ícono de la pestaña y base para el ícono del Wallet |
| `loader.svg` | 96 × 96 | Pantalla de carga completa. Anima solo (anillo que gira, latido y parpadeo) y respeta `prefers-reduced-motion` |
| `empty-clients.svg` | 240 × 180 | Lista de clientes vacía |
| `empty-search.svg` | 240 × 180 | Búsqueda sin resultados |
| `empty-offline.svg` | 240 × 180 | Sin conexión |
| `empty-404.svg` | 240 × 180 | Página no encontrada |
| `empty-expired.svg` | 240 × 180 | Suscripción vencida (escáner en pausa) |
| `reward.svg` | 240 × 180 | "Premio listo": canje y celebraciones |
| `onboarding-1-disena.svg` | 320 × 240 | Onboarding, paso 1: armar la tarjeta |
| `onboarding-2-wallet.svg` | 320 × 240 | Onboarding, paso 2: el cliente la guarda en el Wallet |
| `onboarding-3-escanea.svg` | 320 × 240 | Onboarding, paso 3: sumar sellos con la cámara |

## Cómo usarlos

- Como imagen: `<img src="/assets/empty-clients.svg" alt="" width="240" height="180">`. Si la ilustración acompaña un título que ya dice lo mismo, dejar `alt=""` (es decorativa).
- El `loader.svg` anima también como `<img>`. Para pantalla completa, envolverlo en `.loading-screen` (en `sellito-motion.css`) con un texto de apoyo ("Cargando tu tarjeta…") y `role="status"`.
- Para vacíos y errores, el patrón es siempre el mismo: ilustración, título corto en Fredoka, una frase que explique qué pasó o qué hacer, y un único botón de acción.
- Las ilustraciones de onboarding van sobre un panel `--cream-deep` (`#F6E7CB`) con esquinas de 28 px.

## Detalles que hacen que se sienta cuidado

- Un sello nuevo se "estampa" con `.stamp-in` (en `sellito-motion.css`): entra más grande, rota un poco y asienta.
- Los botones bajan 3 px al presionarse (ya está en `sellito-theme.css`).
- Los toasts entran con un desplazamiento corto de 12 px.
- Ningún texto de carga dice "Cargando...", sino qué se está cargando ("Cargando tus clientes…").
- Todas las animaciones se apagan con `prefers-reduced-motion`.
