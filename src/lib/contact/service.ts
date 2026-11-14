import 'server-only';
import nodemailer from 'nodemailer';
import { Contact, type ContactMessage } from './validation';

const captchaAction = 'contact';
const captchaMinimumScore = 0.5;

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, '');
}

export function mailConfigured() {
  return Boolean(process.env.EMAIL && process.env.EMAIL_PASS);
}
export function captchaSecret() {
  return process.env.RECAPTCHA_SECRET;
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
    text: Contact.formatEmail(data),
  });
  if (!result.accepted.length) {
    throw new Error('Mail was not accepted by the provider');
  }
}

export async function verifyCaptcha(token: string, expectedHostname: string) {
  const secret = captchaSecret();
  if (!token || token.length > Contact.captchaTokenMaxLength || !secret || !expectedHostname) {
    return false;
  }
  const body = new URLSearchParams({ secret, response: token });
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error('Captcha service unavailable');
  }
  const result = (await response.json()) as {
    success?: unknown;
    action?: unknown;
    hostname?: unknown;
    score?: unknown;
  };
  return (
    result.success === true &&
    result.action === captchaAction &&
    typeof result.hostname === 'string' &&
    normalizeHostname(result.hostname) === normalizeHostname(expectedHostname) &&
    typeof result.score === 'number' &&
    Number.isFinite(result.score) &&
    result.score >= captchaMinimumScore &&
    result.score <= 1
  );
}
