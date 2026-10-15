# Sellito: TODO

> Registro de lo que falta. Fuentes: `SELLITO_SPEC.md` (§10 orden de construcción, §11 y §12 pendientes) y `SELLITO_DESIGN_SYSTEM.md` (§6, §7 y §9). Marcar con `[x]` a medida que se completa.

## v1: orden de construcción

### 1. Proyecto Firebase y app conectada ✅
- [x] Proyecto Firebase con Auth (email/contraseña), Firestore, Storage y plan Blaze
- [x] App Vite + React + TS conectada (`web/.env.local`)
- [x] Tema visual (`web/src/styles/sellito-theme.css`) y fuentes cargadas
- [x] Reglas de Firestore y Storage subidas
- [ ] Emuladores locales (requiere Java 21: `brew install openjdk@21`). Hace falta para probar Functions

### 2. Login y creación del negocio ✅
- [x] Login, registro y recuperación de contraseña (`/login`)
- [x] Panel protegido (`/panel`) y creación del negocio con nombre
- [x] Probar el ciclo completo en Safari (cuenta y negocio creados)
- [ ] `slug` único asignado desde una Function
- [ ] Verificación de mail (opcional)

### 3. Editor de tarjeta (`/panel/tarjeta`)
- [x] Subida de logo y banner con vista previa (Storage `businesses/{id}/public/`)
- [x] Selector de colores (fondo y texto) con aviso de poco contraste
- [x] Selector de ícono del sello (8 predefinidos + tilde + subida propia)
- [x] Regla: sellos para el premio (2 a 20) y texto del premio
- [x] Campos que se le piden al cliente (nombre, teléfono, mail)
- [x] Componentes `CardPreview` y `StampGrid` con vista previa en vivo
- [x] Probar el editor en Safari (subir imágenes, guardar, recargar)
- [x] Deshacer/rehacer, descartar cambios y volver al color guardado
- [x] Permiso IAM para que storage.rules lea Firestore
- [ ] Ubicaciones (hasta 10): necesita un buscador de direcciones o mapa
- [ ] Stepper de alta del negocio (1 diseño, 2 regla, 3 pago)
- [ ] Borrar de Storage las imágenes viejas que ya no se usan

### 4. Alta de cliente + Google Wallet
- [x] Cuenta de emisor de Google Wallet creada desde Argentina (Issuer ID en `functions/.env`, modo demo)
- [x] Google Wallet API habilitada y cuenta de servicio `sellito-wallet@sellito-23c14.iam.gserviceaccount.com`
- [x] Agregar la cuenta de servicio como usuario en la consola de Google Pay & Wallet
- [x] Clave de la cuenta de servicio en Secret Manager (`GOOGLE_WALLET_SA_KEY`)
- [ ] Agregar cuentas de prueba (modo demo) para probar en celulares
- [x] Function: crear la clase de loyalty por negocio (`googleClassId`), en el primer alta
- [x] Function `syncGoogleClass`: actualiza la clase cuando el dueño cambia nombre, logo o colores
- [x] Página pública de alta `/c/{código}` con los campos configurados (`getEnrollInfo`)
- [x] Function `createCard`: tarjeta con `barcodeValue` = `S1.{cardId}.{secreto}` y objeto de Google Wallet
- [x] Detección de iPhone (muestra "Apple Wallet llega pronto")
- [x] QR de alta en el panel (descargar PNG, copiar link)
- [x] Probar el ciclo completo en un Android (subir logo → escanear QR → guardar en Wallet)
- [x] Código de tarjeta corto: 12 caracteres sin 0/O/1/I/L, único por negocio (`businesses/{id}/codes/{código}`); la tarjeta muestra solo los últimos 4 (`T9HZ`) bajo el QR y como "ID de miembro"; se guardan en `codeSuffix`
- [x] Título "Tarjeta de fidelidad"; textos emitidos en español
- [x] Color del texto automático (blanco o verde según el fondo, como hace Google); se sacó la opción del editor
- [x] Vista previa del editor igual al frente de la tarjeta en Google Wallet
- [x] Al cambiar diseño o regla se actualizan la clase y todas las tarjetas (`syncGoogleClass` → `resyncBusinessCards`)
- [x] Prueba: las tarjetas viejas se migraron y un +1 actualizó imagen y contador en el Wallet sin volver a agregarla
- [ ] Borrar la tarjeta "Prueba (Claude)" (creada para verificar la imagen en producción)
- [ ] Botón oficial "Add to Google Wallet" (guía de marca de Google)
- [ ] Afiche imprimible con el QR (A5/A4 con la marca del negocio)
- [ ] Rate limit / App Check en `createCard` (hoy cualquiera puede crear tarjetas sin límite)
- [ ] Clientes duplicados: deduplicar por teléfono/mail cuando el negocio los pide

### 5. Escáner, sellos y canje
- [ ] PIN del escáner: elegirlo desde el panel y guardarlo hasheado (Function)
- [ ] PWA `/escaner/{businessId}` con entrada por PIN
- [ ] `ScannerView`: cámara, lectura del código, botones grandes y vibración
- [ ] Ingreso manual por los últimos 4 (`codeSuffix`): mostrar el nombre para confirmar; si hay más de una, elegir por nombre
- [ ] Function: sumar sello (rate limit por tarjeta, log en `stamps`)
- [ ] Function: canjear premio y reiniciar el contador
- [ ] Rate limit y bloqueo del PIN ante intentos fallidos
- [ ] Firebase App Check en la Function del escáner
- [ ] Actualizar el objeto de Google Wallet en cada sello

### 6. Imágenes de sellos ✅ (adelantado)
- [x] Imagen por estado (0/N … N/N) con `@resvg/resvg-js` en `businesses/{id}/generated/{huella}/{n}-de-{N}.png`; no se regenera si existe
- [x] URL distinta por diseño (huella) y por estado: Google no muestra versiones viejas
- [x] Banner de fondo con franja semitransparente para que los sellos se lean
- [ ] Ícono propio del sello en WebP: verificar que resvg lo dibuje (PNG/JPG andan)
- [ ] Limpiar imágenes generadas de diseños viejos

### 7. Apple Wallet
- [ ] Cuenta Apple Developer (USD 99/año) y certificado de Pass Type ID
- [ ] Generar `.pkpass` con `passkit-generator`
- [ ] Endpoints del PassKit web service (registro de dispositivos, pases actualizados)
- [ ] Push a APNs en cada sello

### 8. Mercado Pago
- [ ] Definir planes y precios (¿plan único o por cantidad de clientes?)
- [ ] Definir si hay período de prueba gratis
- [ ] Suscripción (preapproval) desde el panel
- [ ] Webhook que actualiza `subscription.status`
- [ ] Bloquear el escáner si la suscripción no está activa
- [ ] Planes y precios en un documento de configuración (actualizar monto por inflación)
- [ ] Página de "suscripción vencida"

### 9. Estadísticas y super admin
- [ ] `StatCard` y estadísticas simples en el panel (clientes, sellos, premios canjeados)
- [ ] Tabla de clientes con paginación
- [ ] Custom claim `superadmin` para mi cuenta
- [ ] Panel super admin: negocios, estado de pago, métricas

### Antes de lanzar
- [x] Direcciones en variables de entorno (`SITE_URL`, `APP_URL`, `API_URL`); ninguna escrita a mano
- [x] Links de alta cortos y permanentes: `SITE_URL/c/{código}`
- [ ] Conectar `misellito.com.ar` (landing + `/c/*`) a Firebase Hosting cuando termine de propagar
- [ ] Conectar `app.misellito.com.ar` (panel y escáner): probablemente un segundo sitio de Hosting
- [ ] Conectar `api.misellito.com.ar` a las Functions (sitio de Hosting con rewrites a cada Function)
- [ ] Cambiar las variables en `web/.env.local` y `functions/.env`, sacar `DEV_ORIGINS` y volver a desplegar
- [ ] Agregar los dominios nuevos a los dominios autorizados de Firebase Auth
- [ ] Google Wallet: pedir acceso de publicación (salir del modo demo)

### 10. Landing de venta
- [ ] Landing separada de la app
- [x] Favicon
- [ ] Imagen para compartir y banner de la landing

## Diseño (SELLITO_DESIGN_SYSTEM.md §6, §7 y §9)
- [x] Assets y motion integrados (`web/src/assets/`, `sellito-motion.css`, favicon)
- [x] `LoadingScreen`, `Spinner` en botones, `EmptyState`, `Mascot`, página 404, onboarding del dueño (3 pasos)
- [x] Sello nuevo que se "estampa" (`.stamp-in`) en `StampGrid`
- [ ] Navegación: menú lateral del panel, menú de usuario, breadcrumbs (la barra superior con logo ya está)
- [ ] Contenido: tabla, tabs, paginación, lista vacía con el sello triste
- [ ] Skeletons en tablas/cards y barra de progreso (el CSS ya está; usarlos cuando haya listas)
- [ ] Ayuda: tooltip y popover
- [ ] Página de suscripción vencida (ilustración lista, falta el paso 8)
- [ ] Usar `reward.svg` al canjear (paso 5) y `empty-clients.svg` en la tabla de clientes (paso 9)
- [ ] Toasts y diálogos de confirmación (Radix UI + `sonner` o similar)
- [ ] Ícono del Wallet en PNG (varios tamaños) y sellos por rubro (café, pizza, tijera…)
- [ ] Decidir si el ícono del Wallet lleva el borde punteado

## Pendientes por verificar o decidir
- [x] Dominio: `misellito.com.ar`
- [ ] Confirmar Instagram para "Sellito"
- [ ] Notificaciones por cercanía: verificar si `locations` sigue vigente en Google Wallet (aparece como *deprecated*) y cómo lo trata iOS
- [ ] Privacidad y términos para los datos de clientes finales
- [ ] Ley 25.326: evaluar inscripción de la base ante la AAIP

## v2 / Fase 2
- [ ] Rasca y premios aleatorios (página web abierta desde la tarjeta)
- [ ] Una cuenta por empleado en vez de un PIN compartido (el log `stamps.by` ya lo contempla)
- [ ] Modo oscuro
