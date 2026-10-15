# Sellito: especificación del proyecto

> Contexto para trabajar en VS Code. Este archivo describe la idea, las decisiones ya tomadas, la arquitectura, el modelo de datos y el orden de construcción.

## 1. Idea

**Sellito** es una plataforma SaaS self-service de tarjetas de fidelidad (loyalty) digitales para negocios chicos (cafeterías, peluquerías, kioscos, etc.).

- El dueño del negocio se registra solo, diseña su tarjeta, paga una suscripción y la gestiona desde su propio panel.
- El cliente final agrega la tarjeta a **Apple Wallet / Google Wallet** escaneando un QR. No instala ninguna app.
- El negocio suma sellos escaneando la tarjeta del cliente desde una web (PWA), sin instalar nada.
- Ejemplo de regla: "a los 6 cafés, el 7º es gratis".

Meta: construirlo una vez y venderlo a muchos negocios. Cada negocio ve solo lo suyo (multi-tenant).

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Nombre | Sellito |
| Stack | React + Vite + TypeScript + Firebase (sin Next.js: es una app con login, no necesita SEO) |
| Backend | Firebase: Auth, Firestore, Storage, Cloud Functions, Hosting |
| Plan Firebase | Blaze (necesario para Cloud Functions; costo casi cero al empezar) |
| Cobros | Mercado Pago, suscripciones en pesos (Argentina primero) |
| Tipo de tarjeta v1 | Solo sellos ("a los N, premio"). El rasca queda para una fase 2 |
| Datos del cliente | Nombre, teléfono y mail; **cada negocio elige cuáles pedir** |
| Quién escanea en el local | Un PIN compartido por negocio (v1) |
| Landing de venta | Página aparte, separada de la app |
| Ícono del sello | Imagen: galería de íconos predefinidos + opción de subir uno propio |

## 2.1 Dominios

Dominio: `misellito.com.ar` (NIC Argentina, DNS en Cloudflare, Hosting en Firebase).

| Dirección | Qué sirve | Variable |
|---|---|---|
| `misellito.com.ar` | Landing de venta | `SITE_URL` |
| `misellito.com.ar/c/{código}` | Alta de cliente de cada local (el link del QR) | `SITE_URL` |
| `app.misellito.com.ar` | Panel de los negocios y escáner | `APP_URL` |
| `api.misellito.com.ar` | Cloud Functions (Apple Wallet, Mercado Pago, escáner) | `API_URL` |

- Las direcciones viven solo en variables de entorno: `web/.env.local` (`VITE_SITE_URL`, `VITE_APP_URL`, `VITE_API_URL`) y `functions/.env` (`SITE_URL`, `APP_URL`, `API_URL`). **Nunca escribirlas a mano en el código.**
- Hasta conectar el dominio se usan las provisorias de Firebase. **Nada que se imprima o se emita en tarjetas puede usar `*.web.app` ni `*.cloudfunctions.net`**: el panel avisa "Todavía no lo imprimas" y oculta la descarga del QR mientras la dirección sea provisoria.
- El `{código}` de alta tiene 6 caracteres, lo asigna la Function `ensureEnrollCode` y no cambia nunca (está impreso). Se guarda en `businesses/{id}.enrollCode` y en `enrollCodes/{código}` → `businessId`.

## 3. Piezas del sistema

1. **Landing de venta** (separada).
2. **Panel del negocio** (React): registro, editor de tarjeta con vista previa, pago, QR de alta para imprimir, link del escáner, estadísticas simples.
3. **Web de alta del cliente** (React, pública): la abre el QR del local. Pide los datos configurados y muestra el botón "Agregar a Wallet" según el celular.
4. **Escáner del local** (PWA): entra con PIN, usa la cámara, escanea la tarjeta del cliente y suma sello o canjea premio.
5. **Panel super admin** (solo para mí): lista de negocios, estado de pago, métricas.
6. **Cloud Functions**: guardan las llaves de Google/Apple, firman tarjetas, generan imágenes, actualizan Wallets, procesan webhooks de Mercado Pago.

## 4. Flujos

### 4.1 Alta del cliente
1. Escanea el QR estático del local (apunta a `SITE_URL/c/{código}`).
2. Completa los datos que ese negocio pidió.
3. Una Cloud Function crea el documento de la tarjeta con un ID único.
4. La web detecta el sistema operativo:
   - **Android:** link firmado `pay.google.com/gp/v/save/...` (Google Wallet).
   - **iPhone:** descarga de un archivo `.pkpass` (Apple Wallet).

### 4.2 Sumar un sello
- El QR de alta es **estático y solo sirve para el alta**. No suma sellos.
- Cada tarjeta tiene su **propio código único** (QR o barcode) dentro del Wallet.
- El local abre el escáner (PWA, con PIN), escanea la tarjeta y toca "+1".
- Cloud Function: valida el PIN, suma el sello, regenera/actualiza la imagen de la tarjeta y empuja la actualización al Wallet.
- Antiabuso: un sello cada X minutos por tarjeta como máximo, y se registra quién lo cargó.

### 4.3 Canje del premio
- Al llegar a N sellos, la tarjeta muestra "premio disponible".
- El local la escanea de nuevo, toca "Canjear", y el contador se reinicia.

### 4.4 Notificaciones por cercanía
- Cada tarjeta admite hasta **10 ubicaciones** (los locales del negocio).
- Al pasar cerca, el sistema muestra un texto en la pantalla de bloqueo.
- **Limitación:** no se controla cuándo ni con qué frecuencia aparece, y no se pueden mandar push arbitrarios. Solo se muestra el texto de un campo de la tarjeta, por ejemplo "Te falta 1 café", que se actualiza en cada sello.
- No prometerlo como algo garantizado al vender.

## 5. Wallets: detalles técnicos

### Google Wallet
- API REST. Una sola cuenta de emisor (issuer) de Sellito.
- Cada negocio = una **clase** (class) de loyalty con su diseño. Cada cliente = un **objeto** (object).
- Se actualiza modificando el objeto vía API.
- Cuenta de emisor registrada desde Argentina (Issuer ID en `functions/.env`).

### Apple Wallet
- Archivos `.pkpass` generados con `passkit-generator` (Node).
- Requiere cuenta Apple Developer (USD 99/año) y un certificado de Pass Type ID.
- Hay que hostear los endpoints del "PassKit web service" (registro de dispositivos, entrega de pases actualizados).
- Para actualizar: push a APNs, y el iPhone descarga la versión nueva.

### Imágenes de los sellos
- Ni Apple ni Google dibujan los sellos. El backend genera una **imagen** de la tarjeta con sellos llenos y vacíos (ej. 3 de 6).
- Se genera una vez por estado (0/6, 1/6, ... 6/6) y se guarda en Storage. No se regenera en cada escaneo.
- Elementos del diseño: logo, banner, color de fondo, color de texto, ícono del sello, N de sellos para el premio.

## 6. Modelo de datos (Firestore): propuesta inicial

Regla general: todo documento lleva `businessId` para aislar los datos entre negocios.

### `businesses/{businessId}`
- `ownerUid` (string): UID de Firebase Auth del dueño
- `name` (string)
- `slug` (string)
- `design`: `{ logoUrl, bannerUrl, bgColor, textColor, stampIconId | stampIconUrl }`
- `rule`: `{ stampsRequired: number, rewardText: string }`
- `askFields`: `{ name: bool, phone: bool, email: bool }`
- `locations` (array, máx. 10): `{ lat, lng, label }`
- `scannerPinHash` (string): PIN hasheado, nunca en texto plano
- `subscription`: `{ status: "trial" | "active" | "past_due" | "canceled", mpPreapprovalId, plan, currentPeriodEnd }`
- `googleClassId`, `appleTemplateRef`
- `createdAt`, `updatedAt`

### `businesses/{businessId}/cards/{cardId}`
- `customer`: `{ name?, phone?, email? }` (solo los campos que el negocio pidió)
- `stamps` (number): sellos actuales
- `rewardsAvailable` (number)
- `rewardsRedeemed` (number)
- `barcodeValue` (string): valor único del código de la tarjeta
- `platform`: `"google" | "apple"`
- `googleObjectId?`, `appleSerial?`, `applePushToken?`
- `lastStampAt` (timestamp)
- `createdAt`

### `businesses/{businessId}/stamps/{stampId}` (log de eventos)
- `cardId`
- `type`: `"add" | "redeem"`
- `at` (timestamp)
- `by` (identificador del escaneo; en v1 el PIN compartido, más adelante empleado)
- `stampsAfter` (number)

### `appleRegistrations/{...}`
- Registros de dispositivos para el PassKit web service (deviceId, pushToken, passTypeId, serial).

### `users/{uid}`
- `role`: `"owner" | "superadmin"`
- `businessIds` (array)

## 7. Seguridad

- Reglas de Firestore: un dueño solo lee y escribe documentos de sus propios `businessId`.
- El cliente final **no** escribe en Firestore: todo pasa por Cloud Functions.
- El escáner no usa Auth de Firebase en v1: llama a una Function con el PIN, y la Function valida.
- Llaves de Google/Apple y secretos de Mercado Pago en Secret Manager, nunca en el frontend.
- Rate limit por tarjeta (un sello cada X minutos) y por PIN (bloqueo ante intentos fallidos).
- Las suscripciones activas se validan en backend antes de sumar sellos: si el negocio no paga, el escáner no funciona.

## 8. Cobros (Mercado Pago)

- Suscripciones recurrentes (Preapproval / planes de suscripción).
- Webhook en una Cloud Function que actualiza `subscription.status`.
- Pensar el precio en pesos con posibilidad de actualizarlo sin romper las suscripciones existentes (inflación).
- RevenueCat **no** aplica (es para apps móviles).

## 9. Estructura sugerida del repo

```
sellito/
├── web/                  # React + Vite + TS
│   └── src/
│       ├── pages/        # panel, editor, alta cliente, escáner, superadmin
│       ├── components/
│       ├── lib/          # firebase, hooks
│       └── ...
├── functions/            # Cloud Functions (Node + TS)
│   └── src/
│       ├── wallet/       # google.ts, apple.ts
│       ├── cards/        # alta, sellos, canje
│       ├── images/       # generación de imágenes de sellos
│       └── payments/     # webhooks de Mercado Pago
├── firestore.rules
├── firebase.json
└── SELLITO_SPEC.md
```

## 10. Orden de construcción

1. Proyecto Firebase (Auth email/contraseña, Firestore, Storage, plan Blaze) y app Vite conectada.
2. Login de negocios y creación de un negocio.
3. Editor de tarjeta con vista previa en vivo.
4. Alta de cliente + Google Wallet (ciclo completo de prueba con un negocio propio).
5. Escáner PWA, sellos y canje.
6. Generación de imágenes de sellos.
7. Apple Wallet.
8. Mercado Pago (suscripciones y webhook) y bloqueo por falta de pago.
9. Panel con estadísticas simples y panel super admin.
10. Landing de venta.
11. Fase 2: rasca / premios aleatorios (página web abierta desde la tarjeta).

## 11. Pendientes por decidir o verificar

- ~~Verificar que se pueda crear la cuenta de emisor de Google Wallet desde Argentina.~~ Confirmado (2026-10-14).
- ~~Confirmar el dominio~~ `misellito.com.ar` (ver §2.1). Falta confirmar el nombre en Instagram.
- Definir planes y precios (¿un plan único o por cantidad de clientes?).
- Definir si habrá período de prueba gratis.
- Política de datos de clientes finales (privacidad y términos).
- Más adelante: una cuenta por empleado en vez de un PIN compartido.

## 12. Ajustes surgidos de la revisión (ya aplicados en el repo)

- **Campos protegidos:** `ownerUid`, `subscription`, `scannerPinHash`, `googleClassId` y `appleTemplateRef` solo los escriben las Functions. Las reglas de Firestore rechazan cualquier escritura del dueño fuera de `name`, `slug`, `design`, `rule`, `askFields`, `locations`, `createdAt`, `updatedAt`.
- **Super admin:** se identifica con el custom claim `superadmin: true` de Firebase Auth, no con `users/{uid}.role`. La colección `users` es de solo lectura para el cliente.
- **`barcodeValue`:** debe ser aleatorio y no adivinable (no el `cardId` ni secuencial).
- **Escáner:** además del rate limit por PIN, sumar Firebase App Check a la Function del escáner.
- **Región de Functions:** `southamerica-east1` (São Paulo).
- **Storage:** `businesses/{id}/public/` (lo sube el dueño, PNG/JPEG/WebP, máx. 2 MB) y `businesses/{id}/generated/` (solo Functions). Ambas de lectura pública porque los Wallets bajan las imágenes por URL.
- **Imágenes en Google Wallet:** Google las cachea; usar una URL distinta por estado en vez de sobrescribir el mismo archivo.

### Pendientes nuevos

- **Cercanía (§4.4):** verificar en la documentación actual si `locations` sigue vigente en Google Wallet (aparece como *deprecated*) y cómo trata iOS la relevancia por ubicación. Podría no funcionar en Android.
- **Clientes duplicados:** si el cliente escanea el QR de alta dos veces se crean dos tarjetas. Evaluar deduplicar por teléfono/mail cuando el negocio los pide.
- **`slug` único:** asignarlo o validarlo desde una Function para evitar choques entre negocios.
- **Precio con inflación:** Mercado Pago permite actualizar `auto_recurring.transaction_amount` de un preapproval existente. Guardar planes y precios en un documento de configuración.
- **Datos personales:** Ley 25.326 (Argentina); evaluar inscripción de la base ante la AAIP.
