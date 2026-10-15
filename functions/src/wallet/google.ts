import { createSign } from "node:crypto";
import { defineSecret, defineString } from "firebase-functions/params";
import { GoogleAuth } from "google-auth-library";
import { cardCodeSuffix } from "../cards/codes";
import { APP_NAME, SITE_URL, walletOrigins } from "../config";
import { activeLocations, proximityText } from "./proximity";
import type { BusinessDoc, CardDoc } from "../types";

// Clave JSON de sellito-wallet@… (Secret Manager) e Issuer ID (functions/.env).
export const walletKey = defineSecret("GOOGLE_WALLET_SA_KEY");
export const walletIssuerId = defineString("WALLET_ISSUER_ID");

const API = "https://walletobjects.googleapis.com/walletobjects/v1";

type ServiceAccountKey = { client_email: string; private_key: string };

let auth: GoogleAuth | null = null;

function key(): ServiceAccountKey {
  return JSON.parse(walletKey.value()) as ServiceAccountKey;
}

async function request<T>(method: "GET" | "POST" | "PUT" | "PATCH", path: string, data?: object): Promise<T> {
  auth ??= new GoogleAuth({
    credentials: key(),
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });
  const res = await auth.request<T>({ url: `${API}/${path}`, method, data });
  return res.data;
}

function isNotFound(err: unknown): boolean {
  return (err as { status?: number; response?: { status?: number } })?.response?.status === 404
    || (err as { status?: number })?.status === 404;
}

export function classIdFor(businessId: string): string {
  return `${walletIssuerId.value()}.biz-${businessId}`;
}

export function objectIdFor(cardId: string): string {
  return `${walletIssuerId.value()}.card-${cardId}`;
}

function text(value: string) {
  return { defaultValue: { language: "es-419", value } };
}

function image(uri: string, description: string) {
  return { sourceUri: { uri }, contentDescription: text(description) };
}

// Título grande de la tarjeta en el Wallet.
export const PROGRAM_NAME = "Tarjeta de fidelidad";

// La imagen principal (heroImage) va en cada tarjeta, no en la clase: muestra los sellos de ese
// cliente. El banner del negocio queda de fondo dentro de esa imagen (ver images/stamps.ts).
function loyaltyClass(businessId: string, b: BusinessDoc) {
  return {
    id: classIdFor(businessId),
    issuerName: b.name,
    programName: PROGRAM_NAME,
    programLogo: image(b.design!.logoUrl!, b.name),
    hexBackgroundColor: b.design?.bgColor ?? "#FF9EC4",
    // Cercanía: con la opción apagada o sin locales no se mandan (el PUT las borra de la clase).
    merchantLocations: activeLocations(b).map((l) => ({ latitude: l.lat, longitude: l.lng })),
    countryCode: "AR",
    reviewStatus: "UNDER_REVIEW",
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
  };
}

// Crea la clase del negocio o la actualiza si ya existe.
export async function upsertLoyaltyClass(businessId: string, b: BusinessDoc): Promise<string> {
  const body = loyaltyClass(businessId, b);
  try {
    await request("GET", `loyaltyClass/${body.id}`);
    await request("PUT", `loyaltyClass/${body.id}`, body);
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await request("POST", "loyaltyClass", body);
  }
  return body.id;
}

// Lo que cambia con cada sello o con el diseño: contador, imagen, premio y código.
function loyaltyObjectFields(b: BusinessDoc, card: Pick<CardDoc, "stamps" | "barcodeValue">, heroUrl: string) {
  const required = b.rule!.stampsRequired;
  const stamps = Math.min(card.stamps, required);
  const balance = stamps >= required ? "¡Premio listo!" : `${stamps} de ${required}`;
  const shownCode = cardCodeSuffix(card.barcodeValue);
  return {
    accountId: shownCode,
    barcode: { type: "QR_CODE", value: card.barcodeValue, alternateText: shownCode },
    heroImage: image(heroUrl, `${stamps} de ${required} sellos`),
    loyaltyPoints: { label: "Sellos", balance: { string: balance } },
    textModulesData: [
      { id: "progreso", header: "Tu progreso", body: proximityText(b, stamps) },
      { id: "premio", header: "Premio", body: `Al juntar ${required} sellos: ${b.rule!.rewardText}` },
      ...(b.rule!.conditions ? [{ id: "condiciones", header: "Condiciones", body: b.rule!.conditions }] : []),
    ],
    linksModuleData: { uris: [{ id: "marca", uri: SITE_URL.value(), description: `Tarjeta hecha con ${APP_NAME.value()}` }] },
  };
}

export async function insertLoyaltyObject(
  businessId: string,
  cardId: string,
  b: BusinessDoc,
  card: CardDoc,
  heroUrl: string,
): Promise<string> {
  const id = objectIdFor(cardId);
  await request("POST", "loyaltyObject", {
    id,
    classId: classIdFor(businessId),
    state: "ACTIVE",
    ...(card.customer.name ? { accountName: card.customer.name } : {}),
    ...loyaltyObjectFields(b, card, heroUrl),
  });
  return id;
}

// Crea el objeto o, si ya existe (la tarjeta estuvo en Google antes), lo actualiza.
export async function upsertLoyaltyObject(businessId: string, cardId: string, b: BusinessDoc, card: CardDoc, heroUrl: string): Promise<string> {
  try {
    return await insertLoyaltyObject(businessId, cardId, b, card, heroUrl);
  } catch (err) {
    const status = (err as { response?: { status?: number }; status?: number })?.response?.status ?? (err as { status?: number })?.status;
    if (status !== 409) throw err;
    await patchLoyaltyObject(cardId, b, card, heroUrl);
    return objectIdFor(cardId);
  }
}

// Actualiza una tarjeta ya emitida: el Wallet del cliente la refresca solo, sin volver a agregarla.
// `notify`: avisa al cliente que cambió el contador (Google solo avisa por loyaltyPoints.balance).
export async function patchLoyaltyObject(
  cardId: string,
  b: BusinessDoc,
  card: Pick<CardDoc, "stamps" | "barcodeValue">,
  heroUrl: string,
  notify = false,
): Promise<void> {
  await request("PATCH", `loyaltyObject/${objectIdFor(cardId)}`, {
    ...loyaltyObjectFields(b, card, heroUrl),
    ...(notify ? { notifyPreference: "NOTIFY_ON_UPDATE" } : {}),
  });
}

// Mensaje en la tarjeta (se ve atrás). Con `notify`, además llega como notificación al celular.
export async function addLoyaltyMessage(cardId: string, header: string, body: string, notify: boolean): Promise<void> {
  await request("POST", `loyaltyObject/${objectIdFor(cardId)}/addMessage`, {
    message: { id: `msg-${Date.now()}`, header, body, messageType: notify ? "TEXT_AND_NOTIFY" : "TEXT" },
  });
}

// Link "Agregar a Google Wallet": JWT firmado con la clave de la cuenta de servicio.
export function saveUrl(objectIds: string[]): string {
  const k = key();
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: k.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: walletOrigins(),
    payload: { loyaltyObjects: objectIds.map((id) => ({ id })) },
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(k.private_key, "base64url");
  return `https://pay.google.com/gp/v/save/${unsigned}.${signature}`;
}
