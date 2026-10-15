# Sellito

Tarjetas de fidelidad digitales (Apple Wallet / Google Wallet) para negocios chicos. Ver [SELLITO_SPEC.md](SELLITO_SPEC.md), [SELLITO_DESIGN_SYSTEM.md](SELLITO_DESIGN_SYSTEM.md) y lo que falta en [TODO.md](TODO.md).

## Estructura

- `web/`: React + Vite + TS (panel, alta de cliente, escáner, super admin)
- `functions/`: Cloud Functions (Node 22 + TS, región `southamerica-east1`)
- `firestore.rules`, `storage.rules`: reglas de seguridad

## Desarrollo

```bash
# Web
cd web
cp .env.example .env.local   # completar con la config de Firebase
npm install
npm run dev

# Functions
cd functions
npm install
npm run build

# Emuladores (desde la raíz). Poner VITE_USE_EMULATORS=true en web/.env.local
firebase emulators:start
```

## Direcciones

Nunca escribir direcciones propias en el código: van en `web/.env.local` (`VITE_SITE_URL`, `VITE_APP_URL`, `VITE_API_URL`) y en `functions/.env` (`SITE_URL`, `APP_URL`, `API_URL`). Ver `SELLITO_SPEC.md` §2.1.

## Google Wallet: modo demo y acceso de publicación

La cuenta de emisor (Issuer ID en `functions/.env`) está en **modo demo**. Por eso las tarjetas muestran **"[TEST ONLY]"** y solo las pueden guardar las cuentas de prueba cargadas en la consola. No es un bug del código.

**Antes de usarlo con un local real**, pedir el acceso de publicación:

1. Entrar a la [consola de Google Pay y Wallet](https://pay.google.com/business/console) con la cuenta dueña del emisor.
2. Completar el **perfil del negocio** (nombre legal, dirección, sitio web y contacto). Usar `SITE_URL` definitivo (`misellito.com.ar`), no la dirección provisoria de Firebase.
3. Tener lista la **política de privacidad** publicada en el sitio (ver pendientes de la Ley 25.326 en `TODO.md`).
4. En **Google Wallet API**, tocar **"Solicitar acceso de publicación"** (*Request publishing access*) y completar el formulario. Puede pedir capturas de una tarjeta de ejemplo en el celular: usar una de un negocio de prueba con logo, color e imagen de sellos.
5. Google revisa y responde por mail (suele tardar varios días). Cuando lo aprueba, desaparece "[TEST ONLY]" y cualquier cuenta puede guardar tarjetas. **No hay que cambiar nada en el código** (mismo Issuer ID).

Mientras tanto, para probar en otro celular, agregar su cuenta de Google en **Google Wallet API → Usuarios de prueba** (o similar; los nombres de la consola cambian seguido).

## Deploy

```bash
firebase deploy --only firestore:rules,storage   # reglas
# storage.rules lee Firestore: la cuenta service-<NÚMERO>@gcp-sa-firebasestorage.iam.gserviceaccount.com
# necesita el rol roles/firebaserules.firestoreServiceAgent (ya otorgado en sellito-23c14).
# Sin ese rol, toda subida falla con storage/unauthorized.
firebase deploy --only functions                 # requiere plan Blaze
firebase deploy --only hosting                   # compila web/ antes de subir
```
