import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { APP_NAME, APP_URL } from "../config";

// Mails a los dueños. Se escriben en la colección `mail` y los envía la extensión de Firebase
// "Trigger Email from Firestore" (SMTP). Para cambiar de proveedor alcanza con tocar sendMail().

export type MailTemplate = "pastDue" | "graceEnding" | "blocked" | "archiveWarning" | "archived";

type Vars = { businessName: string; days?: number; date?: Date };

const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

function render(t: MailTemplate, v: Vars): { subject: string; text: string } {
  const panel = `${APP_URL.value()}/panel`;
  const app = APP_NAME.value();
  const until = v.date ? fmtDate(v.date) : "";
  switch (t) {
    case "pastDue":
      return {
        subject: `No pudimos cobrar tu suscripción de ${app}`,
        text:
          `Hola,\n\nNo pudimos cobrar la suscripción de ${v.businessName}. ` +
          `Todo sigue funcionando normal hasta el ${until}; para que no se corte, actualizá tu medio de pago:\n\n${panel}\n\n` +
          `Si ya lo resolviste, ignorá este mensaje.`,
      };
    case "graceEnding":
      return {
        subject: `Tu ${app} se pausa en ${v.days} días`,
        text:
          `Hola,\n\nTodavía no pudimos cobrar la suscripción de ${v.businessName}. ` +
          `El ${until} se pausa el escáner del local y no vas a poder sumar sellos.\n\n` +
          `Actualizá tu medio de pago acá:\n\n${panel}`,
      };
    case "blocked":
      return {
        subject: `Tu suscripción de ${app} venció`,
        text:
          `Hola,\n\nLa suscripción de ${v.businessName} venció y el escáner del local quedó en pausa.\n\n` +
          `No se perdió nada: tus clientes conservan sus tarjetas y sus sellos, y desde el panel podés ver tus clientes y exportarlos. ` +
          `Cuando reactives, todo sigue como estaba:\n\n${panel}`,
      };
    case "archiveWarning":
      return {
        subject: `Tu cuenta de ${app} se archiva en ${v.days} días`,
        text:
          `Hola,\n\n${v.businessName} lleva un tiempo con la suscripción vencida. El ${until} vamos a archivar la cuenta.\n\n` +
          `No se borra nada, y podés reactivarla cuando quieras. Si querés guardar los datos de tus clientes, exportalos desde el panel:\n\n${panel}`,
      };
    case "archived":
      return {
        subject: `Archivamos tu cuenta de ${app}`,
        text:
          `Hola,\n\nArchivamos la cuenta de ${v.businessName} porque la suscripción venció hace más de dos meses.\n\n` +
          `No se borró nada: podés entrar al panel, exportar tus clientes o reactivar la suscripción cuando quieras:\n\n${panel}`,
      };
  }
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
  const { subject, text } = render(template, vars);
  await getFirestore().collection("mail").add({
    to,
    message: { subject, text },
    template,
    ownerUid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return true;
}
