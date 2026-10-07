import 'server-only';
import nodemailer from 'nodemailer';
import { emailText, type ContactMessage } from './validation';

export function mailConfigured() {
  return Boolean(process.env.EMAIL && process.env.EMAIL_PASS);
}
// The existing deployment uses RECAPTCHA_KEY; local setup uses the clearer name.
export function captchaSecret() {
  return process.env.RECAPTCHA_SECRET || process.env.RECAPTCHA_KEY;
}

export async function sendContactEmail(data: ContactMessage) {
  const sender = process.env.EMAIL!;
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: sender, pass: process.env.EMAIL_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  const result = await transport.sendMail({
    from: sender,
    to: sender,
    replyTo: data.email,
    subject: `Portfolio: ${data.subject}`,
    text: emailText(data),
  });
  if (!result.accepted.length) throw new Error('Mail was not accepted by the provider');
}

export async function verifyCaptcha(token: string) {
  if (!token || token.length > 4096) return false;
  const body = new URLSearchParams({ secret: captchaSecret()!, response: token });
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Captcha service unavailable');
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
