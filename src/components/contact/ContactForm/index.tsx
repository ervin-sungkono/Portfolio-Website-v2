'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { CircleNotchIcon } from '@phosphor-icons/react';
import { Contact, type ContactErrors } from '@/lib/contact/validation';
import { Button } from '@/components/common/Button';
import { ExternalLink } from '@/components/common/ExternalLink';
import type { ContactFormProps } from './type';
import './style.css';

export function ContactForm({ siteKey }: ContactFormProps) {
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submissionInFlight = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      if (dirty.current) {
        event.preventDefault();
      }
    }
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, []);

  async function captchaToken() {
    if (!siteKey) {
      return '';
    }
    if (!window.grecaptcha) {
      throw new Error('Verification is still loading. Please try again in a moment.');
    }
    const recaptcha = window.grecaptcha;
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Verification timed out. Please try again.'));
      }, 25000);
      recaptcha.ready(() => {
        try {
          recaptcha.execute(siteKey, { action: 'contact' }).then(
            (token) => {
              clearTimeout(timeout);
              resolve(token);
            },
            (error: unknown) => {
              clearTimeout(timeout);
              reject(
                error instanceof Error
                  ? error
                  : new Error('Verification is unavailable. Please try again.'),
              );
            },
          );
        } catch (error) {
          clearTimeout(timeout);
          reject(
            error instanceof Error
              ? error
              : new Error('Verification is unavailable. Please try again.'),
          );
        }
      });
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current || !formRef.current) {
      return;
    }
    const form = formRef.current;
    const input = Object.fromEntries(new FormData(form));
    const result = Contact.validate(input);
    setErrors(result.errors);
    setStatus('');
    const firstError = Contact.fields.find((field) => result.errors[field]);
    if (firstError) {
      form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${firstError}"]`)?.focus();
      return;
    }
    submissionInFlight.current = true;
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
          const field = Contact.fields.find((key) => body.errors?.[key]);
          if (field) {
            form.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus();
          }
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
      submissionInFlight.current = false;
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
      {Contact.fields.map((field) => (
        <div key={field} className="form-field">
          <label htmlFor={`contact-${field}`}>{field[0].toUpperCase() + field.slice(1)}</label>
          {field === 'message' ? (
            <textarea
              id={`contact-${field}`}
              name={field}
              required
              readOnly={busy}
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
              readOnly={busy}
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
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`}
          strategy="afterInteractive"
          onError={() =>
            setStatus('Verification could not load. Please refresh the page or use LinkedIn.')
          }
        />
      )}
      <Button kind="action" type="submit" disabled={busy} className="form-submit">
        {busy ? 'Sending…' : 'Send Message'}{' '}
        {busy && <CircleNotchIcon className="loading-spinner" size={19} aria-hidden="true" />}
      </Button>
      <p className="form-note">
        Your details are used to reply to this message.{' '}
        {siteKey && (
          <>
            This site is protected by reCAPTCHA and the Google{' '}
            <ExternalLink href="https://policies.google.com/privacy">Privacy Policy</ExternalLink>{' '}
            and{' '}
            <ExternalLink href="https://policies.google.com/terms">Terms of Service</ExternalLink>{' '}
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
