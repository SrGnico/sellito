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
- [x] Ubicaciones (hasta 10) con buscador de direcciones (ver 5b)
- [ ] Stepper de alta del negocio (1 diseño, 2 regla, 3 pago)
- [ ] Borrar de Storage las imágenes viejas que ya no se usan

### 4. Alta de cliente + Google Wallet
- [x] Cuenta de emisor de Google Wallet creada desde Argentina (Issuer ID en `functions/.env`, modo demo)
- [x] Google Wallet API habilitada y cuenta de servicio `sellito-wallet@sellito-23c14.iam.gserviceaccount.com`
- [x] Agregar la cuenta de servicio como usuario en la consola de Google Pay & Wallet
- [x] Clave de la cuenta de servicio en Secret Manager (`GOOGLE_WALLET_SA_KEY`)
- [x] Cuentas de prueba (modo demo) para probar en celulares
- [x] Function: crear la clase de loyalty por negocio (`googleClassId`), en el primer alta
- [x] Function `syncGoogleClass`: actualiza la clase cuando el dueño cambia nombre, logo o colores
- [x] Página pública de alta `/c/{código}` con los campos configurados (`getEnrollInfo`)
- [x] Function `createCard`: tarjeta con `barcodeValue` = `S1.{cardId}.{secreto}` y objeto de Google Wallet
- [x] Detección de iPhone (muestra "Apple Wallet llega pronto")
- [x] Vista previa por plataforma: selector Android / iPhone en el editor; en el alta, según el celular
- [x] QR de alta en el panel (descargar PNG, copiar link)
- [x] Probar el ciclo completo en un Android (subir logo → escanear QR → guardar en Wallet)
- [x] Código de tarjeta corto: 12 caracteres sin 0/O/1/I/L, único por negocio (`businesses/{id}/codes/{código}`); la tarjeta muestra solo los últimos 4 (`T9HZ`) bajo el QR y como "ID de miembro"; se guardan en `codeSuffix`
- [x] Título "Tarjeta de fidelidad"; textos emitidos en español
- [x] Color del texto automático (blanco o verde según el fondo, como hace Google); se sacó la opción del editor
- [x] Vista previa del editor igual al frente de la tarjeta en Google Wallet
- [x] Al cambiar diseño o regla se actualizan la clase y todas las tarjetas (`syncGoogleClass` → `resyncBusinessCards`)
- [x] Prueba: las tarjetas viejas se migraron y un +1 actualizó imagen y contador en el Wallet sin volver a agregarla
- [x] Borrada la tarjeta "Prueba (Claude)"
- [ ] Botón oficial "Add to Google Wallet" (guía de marca de Google)
- [ ] Afiche imprimible con el QR (A5/A4 con la marca del negocio)
- [x] Límite de altas: 10 por hora por IP y 500 por día por negocio (`security/rateLimit.ts`)
- [ ] App Check (reCAPTCHA) en el alta y el escáner
- [ ] Política TTL de Firestore sobre `rateLimits.expiresAt` para borrar contadores viejos
- [ ] Clientes duplicados: deduplicar por teléfono/mail cuando el negocio los pide

### 5. Escáner, sellos y canje
- [x] PIN del escáner desde el panel (4–6 números, hasheado con scrypt); cambiarlo cierra todas las sesiones
- [x] `APP_URL/escaner/{businessId}`: entra con PIN, la sesión queda guardada en el celular (90 días)
- [x] Cámara con `qr-scanner` (lector nativo en Android, decodificador propio en iPhone), botones de 56 px, vibración
- [x] Ingreso manual por los últimos 4; si hay más de una tarjeta, elegir por nombre
- [x] Sumar sello: un sello cada 5 minutos por tarjeta, con "Sumar igual" si es otra compra (queda marcado `forced` en el log)
- [x] Canje: al completar la tarjeta, "Canjear premio" con `reward.svg`; el contador vuelve a 0
- [x] Bloqueo del PIN: 5 intentos fallidos → 15 minutos
- [x] Log de cada sello/canje en `businesses/{id}/stamps` (quién: sesión del escáner)
- [x] Actualiza el Wallet después de cada sello o canje
- [x] Escáner en pausa si la suscripción está `past_due` o `canceled` (se activa con el paso 8)
- [x] Probado en el celular del local: PIN → escanear → +1 → canjear
- [ ] Firebase App Check en las Functions del escáner y del alta
- [x] PWA: manifest e ícono para "Agregar a pantalla de inicio" en el escáner; cámara a pedido
- [x] Sacados `testSetStamps` y el panel "Prueba de tarjetas"

### 5b. Cercanía y avisos
- [x] Hasta 10 locales en el editor: dirección → lat/lng con OpenStreetMap (`geocodeAddress`), nombre editable
- [x] Interruptor "Mostrar mi tarjeta cuando el cliente está cerca" (`proximityEnabled`); apagado = sin ubicaciones
- [x] Google: `merchantLocations` en la clase (el texto del aviso lo escribe Google); "Tu progreso" en la tarjeta
- [x] Texto desde la regla: "Te faltan {N} {cafés}" / "¡Tenés tu premio! Pasá a canjearlo" (`rule.itemSingular/itemPlural`)
- [x] Avisos: al sumar (actualización del contador) y al completar (mensaje); máx. 3 por tarjeta cada 24 h, el último reservado para "tarjeta completa"
- [x] Probado: locales, cercanía y avisos
- [ ] Si crece el volumen, pasar el geocoding a un servicio pago (Nominatim pide uso liviano)

### 6. Imágenes de sellos ✅ (adelantado)
- [x] Imagen por estado (0/N … N/N) con `@resvg/resvg-js` en `businesses/{id}/generated/{huella}/{n}-de-{N}.png`; no se regenera si existe
- [x] URL distinta por diseño (huella) y por estado: Google no muestra versiones viejas
- [x] Banner de fondo con franja semitransparente para que los sellos se lean
- [ ] Ícono propio del sello en WebP: verificar que resvg lo dibuje (PNG/JPG andan)
- [ ] Limpiar imágenes generadas de diseños viejos

### 7. Apple Wallet
- [ ] Cercanía: `locations` con `relevantText` = `appleLocations()` (wallet/proximity.ts); sin locales o apagado, no incluir
- [ ] Campo "Tu progreso" con `changeMessage` ("%@") para avisar al sumar y al completar; regenerar el pase en cada sello
- [ ] Imagen de sellos con la proporción de Apple (strip 1125 × 432) y ajustar la vista previa iPhone a la tarjeta real
- [ ] Cuenta Apple Developer (USD 99/año) y certificado de Pass Type ID
- [ ] Generar `.pkpass` con `passkit-generator`
- [ ] Endpoints del PassKit web service (registro de dispositivos, pases actualizados)
- [ ] Push a APNs en cada sello

### 8. Mercado Pago (código listo, falta configurar y probar)
- [x] Suscripción (preapproval) desde el panel: `createSubscription` (suscribirse, reactivar, cambiar medio de pago)
- [x] Webhook `mpWebhook` con firma validada; consulta el estado real a MP
- [x] Estados: `none` (sin suscripción), `trial`, `active`, `past_due` + gracia (`graceUntil`, 7 días), `canceled` (bloqueado), `archived` (60 días bloqueado). Constantes en `functions/src/payments/access.ts`
- [x] Bloqueo: escáner sin sellos ni canje (pantalla "Suscripción vencida"), panel en modo lectura (reglas de Firestore + Functions), Wallet en pausa y resincronización al reactivar
- [x] Sin suscripción: puede diseñar y tener QR, pero el escáner no funciona
- [x] Altas de clientes pausadas con el negocio bloqueado
- [x] Tarea diaria `dailySubscriptionCheck` (09:00 AR): bloquea gracia/prueba vencidas, archiva, manda mails
- [x] Mails (colección `mail`): cobro fallido, faltan 2 días, bloqueado, aviso de archivo, archivado
- [x] Prueba gratis preparada (`trialDays` en `config/plans`, hoy 0) y `subscription.plan` admite un plan anual
- [x] Precios en `config/plans` (se copian a la suscripción: cambiar el precio no toca las existentes)
- [x] `config/plans`: Mensual $25.000, sin prueba gratis
- [x] Secretos `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` cargados y Functions desplegadas
- [ ] En Mercado Pago: webhook a `API_URL/mpWebhook` con los eventos de suscripciones (preapproval y authorized_payment)
- [ ] Instalar la extensión "Trigger Email from Firestore" (colección `mail`) con SMTP (Resend) y remitente `avisos@misellito.com.ar`
- [x] Probado el alta con usuarios de prueba de MP
- [ ] Probar cobro rechazado → gracia → bloqueo → reactivar
- [x] El dueño confirma el mail de su cuenta de MP antes de pagar (prueba: `test_user_<USER_ID>@testuser.com`)
- [ ] Actualizar monto de suscripciones existentes por inflación (PUT `auto_recurring.transaction_amount`)

### 9. Clientes, estadísticas y super admin
- [x] Sección Clientes (`/panel/clientes`): tabla de a 25 con paginación, orden por alta / último sello / sellos
- [x] Búsqueda por nombre, teléfono o mail (prefijos en `searchTokens`; tarjetas viejas se completan con `upgradeCards`)
- [x] Filtros: con premio, inactivos +30 días, nuevos esta semana
- [x] Detalle del cliente con historial de sellos; botones de WhatsApp y mail
- [x] `StatCard`: clientes, nuevos 7 días, sellos del mes, premios canjeados
- [x] Exportar contactos (CSV UTF-8 con BOM, separador `;`) en Function, respeta filtros, anda en modo lectura
- [x] Aviso de privacidad para el dueño y casilla de novedades en el alta (`consent` en la tarjeta). Textos en `web/src/content/privacy.ts`
- [x] Índices desplegados
- [x] Custom claim `superadmin` para srgnicor@gmail.com
- [x] Panel super admin (`/admin`): negocios, estado, plan, tarjetas, PIN; métricas (negocios, activas, ingreso mensual, tarjetas)

### Antes de lanzar
- [x] Direcciones en variables de entorno (`SITE_URL`, `APP_URL`, `API_URL`); ninguna escrita a mano
- [x] Links de alta cortos y permanentes: `SITE_URL/c/{código}`
- [x] `misellito.com.ar` conectado (sitio `sellito-23c14`); `SITE_URL` ya apunta ahí y el QR se puede imprimir
- [x] `app.misellito.com.ar` activo (CNAME `app` → `sellito-23c14.web.app`)
- [x] `api.misellito.com.ar` activo (sitio `sellito-api`, rewrites a cada Function en `firebase.json`)
- [x] `VITE_API_URL` y `API_URL` = `https://api.misellito.com.ar`; `DEV_ORIGINS` solo localhost (desplegado)
- [ ] Cada Function nueva que llame la web: agregar su rewrite en el sitio `sellito-api` (`firebase.json`)
- [ ] Ojo: Hosting corta a los 60 s. `resyncCards` con muchas tarjetas puede pasarse: hacerlo en segundo plano
- [x] Dominios autorizados de Firebase Auth: `misellito.com.ar` y `app.misellito.com.ar`
- [ ] Separar la landing (`misellito.com.ar`) del panel (`app.`) cuando exista la landing
- [ ] Google Wallet: pedir acceso de publicación (salir del modo demo)

### 10. Landing de venta
- [ ] Landing separada de la app
- [x] Favicon
- [ ] Imagen para compartir y banner de la landing
- [ ] Landing: describir la cercanía como "puede aparecer en la pantalla de bloqueo cuando está cerca del local" (no prometer que siempre aparece)

## Diseño (SELLITO_DESIGN_SYSTEM.md §6, §7 y §9)
- [x] Assets y motion integrados (`web/src/assets/`, `sellito-motion.css`, favicon)
- [x] `LoadingScreen`, `Spinner` en botones, `EmptyState`, `Mascot`, página 404, onboarding del dueño (3 pasos)
- [x] Sello nuevo que se "estampa" (`.stamp-in`) en `StampGrid`
- [x] Navegación del panel por secciones (Inicio, Clientes, Tarjeta, QR, Escáner) e inicio como resumen
- [ ] Contenido: tabla, tabs, paginación, lista vacía con el sello triste
- [ ] Skeletons en tablas/cards y barra de progreso (el CSS ya está; usarlos cuando haya listas)
- [ ] Ayuda: tooltip y popover
- [x] Página de suscripción vencida (escáner)
- [ ] Usar `reward.svg` al canjear (paso 5) y `empty-clients.svg` en la tabla de clientes (paso 9, hecho)
- [ ] Toasts y diálogos de confirmación (Radix UI + `sonner` o similar)
- [ ] Ícono del Wallet en PNG (varios tamaños) y sellos por rubro (café, pizza, tijera…)
- [ ] Decidir si el ícono del Wallet lleva el borde punteado

## Pendientes por verificar o decidir
- [x] Dominio: `misellito.com.ar`
- [ ] Confirmar Instagram para "Sellito"
- [x] Cercanía verificada: Google usa `merchantLocations` (texto del aviso lo pone Google); Apple `locations` + `relevantText`
- [ ] Privacidad y términos para los datos de clientes finales
- [ ] Ley 25.326: evaluar inscripción de la base ante la AAIP

## v2 / Fase 2
- [ ] Rasca y premios aleatorios (página web abierta desde la tarjeta)
- [ ] Una cuenta por empleado en vez de un PIN compartido (el log `stamps.by` ya lo contempla)
- [ ] Modo oscuro
