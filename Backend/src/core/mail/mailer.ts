import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config/app.config";

/**
 * Outgoing mail.
 *
 * One transport for the whole process, made from the settings (SMTP_*): the
 * same code sends through a Gmail account while testing and through the
 * university's server in production — only the settings change.
 *
 * Sending never fails the request that asked for it, nor makes it wait: a
 * reset link is answered "if the account has an address, a link is on its
 * way" whatever the mail server does, and a sign-in is not held up by a
 * slow SMTP. Failures are logged, without the message or the address.
 *
 * Under tests nothing leaves the machine: messages are kept in `outbox`.
 */

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Pictures the message shows (`cid:`) — the university's seal: our own bytes, never a path or an address. */
  attachments?: { filename: string; content: Buffer; cid: string; contentType: string }[];
}

/** What was "sent" during tests, newest last. */
export const outbox: Mail[] = [];

const testing = config.NODE_ENV === "test";
let transport: Transporter | null = null;
let warned = false;

/** Whether mail can be sent at all — the forgot-password page asks. */
export const mailEnabled = () => testing || !!config.MAIL.host;

function transporter(): Transporter | null {
  if (transport) return transport;
  if (testing) return (transport = nodemailer.createTransport({ jsonTransport: true }));
  if (!config.MAIL.host) {
    if (!warned) {
      warned = true;
      console.warn(JSON.stringify({ level: "warn", scope: "mail", message: "SMTP_HOST is not set: mail is off" }));
    }
    return null;
  }
  transport = nodemailer.createTransport({
    host: config.MAIL.host,
    port: config.MAIL.port,
    secure: config.MAIL.secure,
    auth: config.MAIL.user ? { user: config.MAIL.user, pass: config.MAIL.pass ?? "" } : undefined,
    // Never send a password over a connection that is not encrypted.
    requireTLS: !config.MAIL.secure,
    // The message is built here from our own text: it reads no file and
    // fetches no address, whatever ends up in it.
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return transport;
}

/** Sends in the background; resolves to whether the server accepted it. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const t = transporter();
  if (!t) return false;
  try {
    await t.sendMail({ from: config.MAIL.from ?? "Mudhakkirati <noreply@localhost>", ...mail });
    if (testing) outbox.push(mail);
    return true;
  } catch (error) {
    console.error(JSON.stringify({ level: "error", scope: "mail", message: (error as Error)?.message }));
    return false;
  }
}

/** Fire and forget — for callers that must not wait on the mail server. */
export function queueMail(mail: Mail): void {
  void sendMail(mail);
}
