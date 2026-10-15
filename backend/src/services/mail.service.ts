import nodemailer from "nodemailer";
import { env } from "../env";

const transport = env.mail.host
  ? nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
    })
  : null;

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
  if (!transport) {
    if (process.env.NODE_ENV === "production") {
      console.error(`[mail] MAIL_HOST não configurado; e-mail para ${to} não enviado.`);
    } else {
      console.log(`[mail] (dev, sem SMTP) Para: ${to}\nAssunto: ${subject}\n${text}`);
    }
    return;
  }
  await transport.sendMail({ from: env.mail.from, to, subject, text, html });
}
