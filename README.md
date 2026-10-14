# Sellito

Tarjetas de fidelidad digitales (Apple Wallet / Google Wallet) para negocios chicos. Ver [SELLITO_SPEC.md](SELLITO_SPEC.md).

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

## Deploy

```bash
firebase deploy --only firestore:rules,storage   # reglas
firebase deploy --only functions                 # requiere plan Blaze
firebase deploy --only hosting                   # compila web/ antes de subir
```
