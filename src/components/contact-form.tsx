'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRightIcon, CircleNotchIcon } from '@phosphor-icons/react';
import { contactFields, validateContact, type ContactErrors } from '@/lib/contact/validation';

type Captcha = {
  render: (element: HTMLElement, options: Record<string, unknown>) => number;
  execute: (id: number) => void;
  reset: (id: number) => void;
};
declare global {
  interface Window {
    grecaptcha?: Captcha;
    portfolioCaptchaReady?: () => void;
  }
}

export function ContactForm({ siteKey }: { siteKey?: string }) {
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaReady, setCaptchaReady] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const captchaElement = useRef<HTMLDivElement>(null);
  const widget = useRef<number | null>(null);
  const dirty = useRef(false);
  const pending = useRef<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  } | null>(null);

  useEffect(() => {
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      if (dirty.current) event.preventDefault();
    }
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, []);

  useEffect(() => {
    if (!siteKey) return;
    window.portfolioCaptchaReady = () => setCaptchaReady(true);
    if (typeof window.grecaptcha?.render === 'function') setCaptchaReady(true);
    return () => {
      delete window.portfolioCaptchaReady;
    };
  }, [siteKey]);

  useEffect(() => {
    if (
      !captchaReady ||
      !siteKey ||
      !captchaElement.current ||
      !window.grecaptcha ||
      widget.current !== null
    )
      return;
    widget.current = window.grecaptcha.render(captchaElement.current, {
      sitekey: siteKey,
      size: 'invisible',
      badge: 'inline',
      theme: document.documentElement.dataset.theme || 'light',
      callback: (token: string) => {
        pending.current?.resolve(token);
        pending.current = null;
      },
      'error-callback': () => {
        pending.current?.reject(new Error('Verification is unavailable. Please try again.'));
        pending.current = null;
      },
      'expired-callback': () => {
        pending.current?.reject(new Error('Verification expired. Please try again.'));
        pending.current = null;
      },
    });
    return () => {
      pending.current?.reject(new Error('Verification cancelled.'));
      pending.current = null;
    };
  }, [captchaReady, siteKey]);

  async function captchaToken() {
    if (!siteKey) return '';
    if (!window.grecaptcha || widget.current === null)
      throw new Error('Verification is still loading. Please try again in a moment.');
    const id = widget.current;
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.current = null;
        reject(new Error('Verification timed out. Please try again.'));
      }, 25000);
      pending.current = {
        resolve: (token) => {
          clearTimeout(timeout);
          resolve(token);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      };
      window.grecaptcha!.reset(id);
      window.grecaptcha!.execute(id);
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !formRef.current) return;
    const form = formRef.current;
    const input = Object.fromEntries(new FormData(form));
    const result = validateContact(input);
    setErrors(result.errors);
    setStatus('');
    const firstError = contactFields.find((field) => result.errors[field]);
    if (firstError) {
      form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${firstError}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const token = await captchaToken();
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...result.data,
          website: input.website || '',
          recaptcha_token: token,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const body = (await response.json()) as {
        success?: boolean;
        message?: string;
        errors?: ContactErrors;
      };
      if (!response.ok || !body.success) {
        if (body.errors) {
          setErrors(body.errors);
          const field = contactFields.find((key) => body.errors?.[key]);
          if (field) form.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus();
        }
        throw new Error(body.message || 'Your message could not be sent. Please try again.');
      }
      form.reset();
      dirty.current = false;
      setStatus(body.message || 'Your message has been sent.');
    } catch (error) {
      setStatus(
        error instanceof Error && error.name !== 'TimeoutError'
          ? error.message
          : 'The request timed out. Please try again or use LinkedIn.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onInput={() => {
        dirty.current = true;
      }}
      noValidate
      className="contact-form"
      aria-busy={busy}
    >
      {contactFields.map((field) => (
        <div key={field} className="form-field">
          <label htmlFor={`contact-${field}`}>{field[0].toUpperCase() + field.slice(1)}</label>
          {field === 'message' ? (
            <textarea
              id={`contact-${field}`}
              name={field}
              required
              maxLength={5000}
              placeholder="Tell me what you have in mind…"
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `error-${field}` : undefined}
            />
          ) : (
            <input
              id={`contact-${field}`}
              name={field}
              type={field === 'email' ? 'email' : 'text'}
              required
              maxLength={field === 'name' ? 100 : field === 'email' ? 254 : 160}
              autoComplete={field === 'name' ? 'name' : field === 'email' ? 'email' : 'off'}
              spellCheck={field !== 'email'}
              placeholder={
                field === 'name'
                  ? 'Your name…'
                  : field === 'subject'
                    ? 'An opportunity or a project…'
                    : 'you@example.com…'
              }
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `error-${field}` : undefined}
            />
          )}
          {errors[field] && (
            <p className="field-error" id={`error-${field}`}>
              {errors[field]}
            </p>
          )}
        </div>
      ))}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {siteKey && (
        <>
          <Script
            src="https://www.google.com/recaptcha/api.js?onload=portfolioCaptchaReady&render=explicit"
            strategy="afterInteractive"
            onReady={() => {
              if (typeof window.grecaptcha?.render === 'function') setCaptchaReady(true);
            }}
            onError={() =>
              setStatus('Verification could not load. Please refresh the page or use LinkedIn.')
            }
          />
          <div ref={captchaElement} className="captcha-container" />
        </>
      )}
      <button type="submit" disabled={busy} className="button form-submit">
        {busy ? 'Sending…' : 'Send Message'}{' '}
        {busy ? (
          <CircleNotchIcon className="loading-spinner" size={19} aria-hidden="true" />
        ) : (
          <ArrowUpRightIcon size={19} aria-hidden="true" />
        )}
      </button>
      <p className="form-note">
        Your details are used to reply to this message.{' '}
        {siteKey && (
          <>
            Protected by reCAPTCHA. Google’s{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
              Terms
            </a>{' '}
            apply.
          </>
        )}
      </p>
      <div aria-live="polite" aria-atomic="true">
        {status && <p className="form-status">{status}</p>}
      </div>
    </form>
  );
}
