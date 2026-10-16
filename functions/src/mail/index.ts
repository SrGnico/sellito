import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret, defineString } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { APP_NAME, APP_URL, SITE_URL } from "../config";
import type { BusinessDoc } from "../types";

// Mails a los dueños de los negocios. sendMail() los deja en la colección `mail` (queda el registro de
// qué se mandó) y deliverMail los envía con Resend. Para cambiar de proveedor alcanza con tocar deliverMail.
//   MAIL_FROM / MAIL_REPLY_TO → functions/.env       RESEND_API_KEY → Secret Manager

const resendKey = defineSecret("RESEND_API_KEY");
const MAIL_FROM = defineString("MAIL_FROM");
const MAIL_REPLY_TO = defineString("MAIL_REPLY_TO", { default: "" });
// Avisos internos para quien administra Sellito (altas, suscripciones, cobros fallidos).
const ADMIN_EMAIL = defineString("ADMIN_EMAIL", { default: "" });

// Los documentos de `mail` se borran solos a los 180 días (política TTL sobre expiresAt).
const KEEP_DAYS = 180;

export type MailTemplate = "welcome" | "activated" | "pastDue" | "graceEnding" | "blocked" | "archiveWarning" | "archived";

type Vars = { businessName: string; days?: number; date?: Date };
type Mail = { subject: string; paragraphs: string[]; cta: string };

const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

function content(t: MailTemplate, v: Vars): Mail {
  const app = APP_NAME.value();
  const until = v.date ? fmtDate(v.date) : "";
  switch (t) {
    case "welcome":
      return {
        subject: `¡Te damos la bienvenida a ${app}!`,
        paragraphs: [
          `Ya creaste ${v.businessName}. En unos minutos tenés tu tarjeta de sellos lista:`,
          "1. Diseñala: logo, color y el premio que quieras regalar.\n2. Creá el PIN del escáner.\n3. Imprimí el QR y ponelo en el mostrador.",
          "Tus clientes escanean el QR y guardan la tarjeta en el celular, sin descargar nada. Y la lista de clientes que se va armando es tuya.",
          "Un extra: podés prender el saludo de cumpleaños. La tarjeta saluda sola a cada cliente en su día, con un regalo si querés. 🎂",
        ],
        cta: "Armar mi tarjeta",
      };
    case "activated":
      return {
        subject: `Tu suscripción de ${app} está activa`,
        paragraphs: [
          `¡Listo! La suscripción de ${v.businessName} quedó activa y el escáner del local ya puede sumar sellos.`,
          "El cobro se renueva solo cada mes con Mercado Pago. Si alguna vez falla, te avisamos por acá y tenés unos días para resolverlo sin que se corte nada.",
        ],
        cta: "Ir al panel",
      };
    case "pastDue":
      return {
        subject: `No pudimos cobrar tu suscripción de ${app}`,
        paragraphs: [
          `No pudimos cobrar la suscripción de ${v.businessName}.`,
          `Todo sigue funcionando normal hasta el ${until}. Para que no se corte, actualizá tu medio de pago.`,
          "Si ya lo resolviste, ignorá este mensaje.",
        ],
        cta: "Actualizar medio de pago",
      };
    case "graceEnding":
      return {
        subject: `Tu ${app} se pausa en ${v.days} ${v.days === 1 ? "día" : "días"}`,
        paragraphs: [
          `Todavía no pudimos cobrar la suscripción de ${v.businessName}.`,
          `El ${until} se pausa el escáner del local y no vas a poder sumar sellos. Actualizá tu medio de pago para que no pase.`,
        ],
        cta: "Actualizar medio de pago",
      };
    case "blocked":
      return {
        subject: `Tu suscripción de ${app} venció`,
        paragraphs: [
          `La suscripción de ${v.businessName} venció y el escáner del local quedó en pausa.`,
          "No se perdió nada: tus clientes conservan sus tarjetas y sus sellos, y desde el panel podés ver tus clientes y descargarlos. Cuando reactives, todo sigue como estaba.",
        ],
        cta: "Reactivar",
      };
    case "archiveWarning":
      return {
        subject: `Tu cuenta de ${app} se archiva en ${v.days} días`,
        paragraphs: [
          `${v.businessName} lleva un tiempo con la suscripción vencida. El ${until} vamos a archivar la cuenta.`,
          "No se borra nada y podés reactivarla cuando quieras. Si querés guardar los datos de tus clientes, descargalos desde el panel.",
        ],
        cta: "Ir al panel",
      };
    case "archived":
      return {
        subject: `Archivamos tu cuenta de ${app}`,
        paragraphs: [
          `Archivamos la cuenta de ${v.businessName} porque la suscripción venció hace más de dos meses.`,
          "No se borró nada: podés entrar al panel, descargar tus clientes o reactivar la suscripción cuando quieras.",
        ],
        cta: "Ir al panel",
      };
  }
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// HTML simple con tablas y estilos en línea (lo que leen bien Gmail, Outlook y Apple Mail).
export function render(t: MailTemplate, v: Vars): { subject: string; text: string; html: string } {
  const { subject, paragraphs, cta } = content(t, v);
  const panel = `${APP_URL.value()}/panel`;
  const app = APP_NAME.value();
  const site = SITE_URL.value();
  const text = ["Hola,", ...paragraphs, `${cta}: ${panel}`, `— ${app}`].join("\n\n");
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#12372A">${escape(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#FFF4E2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF4E2;padding:32px 16px;font-family:Helvetica,Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 16px;font-size:22px;font-weight:700;color:#12372A">${escape(app)}</td></tr>
<tr><td style="background:#FFFDF8;border:2px solid #12372A;border-radius:20px;padding:28px 24px">
<p style="margin:0 0 16px;font-size:16px;color:#12372A">Hola,</p>
${body}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px"><tr><td style="background:#12372A;border-radius:14px">
<a href="${panel}" style="display:inline-block;padding:14px 22px;font-size:16px;font-weight:700;color:#FFF4E2;text-decoration:none">${escape(cta)}</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:#5B6F66">
Te escribimos porque tenés una cuenta en <a href="${site}" style="color:#5B6F66">${escape(app)}</a>. Son avisos de tu cuenta, no publicidad.
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

async function ownerEmail(ownerUid: string): Promise<string | null> {
  try {
    return (await getAuth().getUser(ownerUid)).email ?? null;
  } catch (err) {
    logger.warn("No se encontró el mail del dueño", { ownerUid, err });
    return null;
  }
}

export async function sendMail(ownerUid: string, template: MailTemplate, vars: Vars): Promise<boolean> {
  const to = await ownerEmail(ownerUid);
  if (!to) return false;
  const { subject, text, html } = render(template, vars);
  await getFirestore().collection("mail").add({
    to,
    message: { subject, text, html },
    template,
    ownerUid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + KEEP_DAYS * 86_400_000),
  });
  return true;
}

// Aviso interno al administrador. Texto simple: es para vos, no para el cliente.
export async function notifyAdmin(subject: string, lines: string[]): Promise<void> {
  const to = ADMIN_EMAIL.value();
  if (!to) return;
  try {
    const admin = `${APP_URL.value()}/admin`;
    const text = [...lines, "", `Panel de administración: ${admin}`].join("\n");
    const html =
      `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#12372A">` +
      lines.map((l) => `<p style="margin:0 0 8px">${escape(l)}</p>`).join("") +
      `<p style="margin:16px 0 0"><a href="${admin}" style="color:#12372A">Abrir el panel de administración</a></p></div>`;
    await getFirestore().collection("mail").add({
      to,
      message: { subject: `[${APP_NAME.value()}] ${subject}`, text, html },
      template: "admin",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + KEEP_DAYS * 86_400_000),
    });
  } catch (err) {
    logger.error("No se pudo encolar el aviso al administrador", { subject, err });
  }
}

// Envío real con la API de Resend. El id del documento evita mandar dos veces el mismo mail si se reintenta.
export const deliverMail = onDocumentCreated({ document: "mail/{mailId}", secrets: [resendKey] }, async (event) => {
  const mail = event.data?.data() as { to: string; message: { subject: string; text: string; html?: string } } | undefined;
  if (!mail || !event.data) return;
  const replyTo = MAIL_REPLY_TO.value();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey.value()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": event.params.mailId,
      },
      body: JSON.stringify({
        from: MAIL_FROM.value(),
        to: [mail.to],
        subject: mail.message.subject,
        text: mail.message.text,
        html: mail.message.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? "sin detalle"}`);
    await event.data.ref.update({ delivery: { state: "SUCCESS", id: body.id ?? null, at: FieldValue.serverTimestamp() } });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("No se pudo enviar un mail", { mailId: event.params.mailId, error });
    await event.data.ref.update({ delivery: { state: "ERROR", error, at: FieldValue.serverTimestamp() } });
  }
});

// Bienvenida al crear un negocio (no para la tarjeta de ejemplo de la landing).
export const welcomeMail = onDocumentCreated("businesses/{businessId}", async (event) => {
  const b = event.data?.data() as BusinessDoc | undefined;
  if (!b || b.demo || !b.ownerUid) return;
  try {
    await sendMail(b.ownerUid, "welcome", { businessName: b.name });
  } catch (err) {
    logger.error("No se pudo encolar la bienvenida", { businessId: event.params.businessId, err });
  }
  const email = await ownerEmail(b.ownerUid);
  await notifyAdmin(`Nuevo negocio: ${b.name}`, [`Se registró ${b.name}.`, `Cuenta: ${email ?? "sin mail"}`, `ID: ${event.params.businessId}`]);
});
