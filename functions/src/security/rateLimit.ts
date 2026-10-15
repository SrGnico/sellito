import { createHash } from "node:crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

// Límite de uso por ventana fija (contador en `rateLimits/{hash}`, solo lo usan las Functions).
// Protege lo que es público o cuesta algo: altas de clientes, búsqueda de direcciones y pagos.
// `expiresAt` permite activar una política TTL de Firestore para que los contadores viejos se borren solos.
export async function rateLimit(key: string, max: number, windowMs: number): Promise<void> {
  const ref = getFirestore().doc(`rateLimits/${createHash("sha256").update(key).digest("hex").slice(0, 40)}`);
  const allowed = await getFirestore().runTransaction(async (tx) => {
    const now = Date.now();
    const d = (await tx.get(ref)).data() as { count: number; windowStart: number } | undefined;
    if (!d || now - d.windowStart >= windowMs) {
      tx.set(ref, { count: 1, windowStart: now, expiresAt: Timestamp.fromMillis(now + windowMs) });
      return true;
    }
    if (d.count >= max) return false;
    tx.update(ref, { count: d.count + 1 });
    return true;
  });
  if (!allowed) throw new HttpsError("resource-exhausted", "rate-limit");
}

// IP del cliente: la primera de x-forwarded-for (Hosting y Cloud Run la agregan).
export function clientIp(req: CallableRequest): string {
  const fwd = req.rawRequest.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return first || req.rawRequest.ip || "unknown";
}

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;
