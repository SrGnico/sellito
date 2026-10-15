import { createHmac, timingSafeEqual } from "node:crypto";
import { defineSecret } from "firebase-functions/params";
import type { Plan } from "./plans";

// API de suscripciones de Mercado Pago (preapproval). Los secretos van en Secret Manager:
//   firebase functions:secrets:set MP_ACCESS_TOKEN
//   firebase functions:secrets:set MP_WEBHOOK_SECRET   (la "clave secreta" de Webhooks en el panel de MP)
export const mpAccessToken = defineSecret("MP_ACCESS_TOKEN");
export const mpWebhookSecret = defineSecret("MP_WEBHOOK_SECRET");

const MP_API = "https://api.mercadopago.com";

export type Preapproval = {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  external_reference?: string; // businessId
  init_point?: string;
  next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number; currency_id?: string };
};

export type AuthorizedPayment = {
  id: number | string;
  preapproval_id: string;
  status: string; // scheduled | processed | recycling | cancelled
  payment?: { id?: number; status?: string; status_detail?: string }; // approved | rejected | ...
};

async function mp<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${mpAccessToken.value()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Mercado Pago ${method} ${path}: ${res.status} ${text.slice(0, 500)}`);
  return JSON.parse(text) as T;
}

export function createPreapproval(input: {
  businessId: string;
  reason: string;
  payerEmail: string;
  plan: Plan;
  backUrl: string;
}): Promise<Preapproval> {
  return mp<Preapproval>("POST", "/preapproval", {
    reason: input.reason,
    external_reference: input.businessId,
    payer_email: input.payerEmail,
    back_url: input.backUrl,
    status: "pending",
    auto_recurring: {
      frequency: input.plan.frequency,
      frequency_type: input.plan.frequencyType,
      transaction_amount: input.plan.amount,
      currency_id: input.plan.currency,
    },
  });
}

export const getPreapproval = (id: string) => mp<Preapproval>("GET", `/preapproval/${encodeURIComponent(id)}`);
export const cancelPreapproval = (id: string) =>
  mp<Preapproval>("PUT", `/preapproval/${encodeURIComponent(id)}`, { status: "cancelled" });
export const getAuthorizedPayment = (id: string) =>
  mp<AuthorizedPayment>("GET", `/authorized_payments/${encodeURIComponent(id)}`);

// Firma de los webhooks: header x-signature "ts=...,v1=..." = HMAC-SHA256 de
// "id:{data.id};request-id:{x-request-id};ts:{ts};" con la clave secreta.
export function validSignature(signature: string | undefined, requestId: string | undefined, dataId: string): boolean {
  if (!signature) return false;
  const parts = Object.fromEntries(
    signature.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]),
  );
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};${requestId ? `request-id:${requestId};` : ""}ts:${parts.ts};`;
  const expected = createHmac("sha256", mpWebhookSecret.value()).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
