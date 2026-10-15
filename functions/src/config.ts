import { defineString } from "firebase-functions/params";

// Nombre y direcciones públicas de la app (functions/.env). Nunca escribirlas a mano en el código:
// cuando se conecte misellito.com.ar solo cambian estos valores.
//   SITE_URL → landing y links de alta (SITE_URL/c/{código}, el del QR)
//   APP_URL  → panel de los negocios y escáner
//   API_URL  → estas Functions (Apple Wallet, Mercado Pago, escáner)
export const APP_NAME = defineString("APP_NAME", { default: "Sellito" });
export const SITE_URL = defineString("SITE_URL");
export const APP_URL = defineString("APP_URL");
export const API_URL = defineString("API_URL");

// Orígenes extra para desarrollo local (separados por coma). Vacío en producción.
export const DEV_ORIGINS = defineString("DEV_ORIGINS", { default: "" });

export function enrollUrl(code: string): string {
  return `${SITE_URL.value()}/c/${code}`;
}

// Sitios desde los que se puede abrir el link "Agregar a Google Wallet".
export function walletOrigins(): string[] {
  const dev = DEV_ORIGINS.value().split(",").map((o) => o.trim()).filter(Boolean);
  return [...new Set([SITE_URL.value(), APP_URL.value(), ...dev])];
}
