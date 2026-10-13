'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/cms/auth-client';
import styles from './login-form.module.css';

type LoginStage = 'password' | 'factor';
type FactorMethod = 'totp' | 'backup';

function isTwoFactorRedirect(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'twoFactorRedirect' in value &&
    value.twoFactorRedirect === true
  );
}

export function LoginForm({
  reauth = false,
  returnTo = '/admin',
}: {
  reauth?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<LoginStage>('password');
  const [method, setMethod] = useState<FactorMethod>('totp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const pendingRef = useRef(false);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    setMessage('');
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setPassword('');
        setMessage('Email or password could not be verified. Check your details and try again.');
        return;
      }

      if (isTwoFactorRedirect(result.data)) {
        setPassword('');
        setStage('factor');
        setCode('');
        return;
      }

      router.replace(returnTo);
      router.refresh();
    } catch {
      setPassword('');
      setMessage('Sign in is temporarily unavailable. Please try again.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function handleFactorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    setMessage('');
    try {
      const result =
        method === 'backup'
          ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: false })
          : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: false });

      if (result.error) {
        setCode('');
        setMessage('That code could not be verified. Try again or use another recovery code.');
        return;
      }

      router.replace(returnTo);
      router.refresh();
    } catch {
      setCode('');
      setMessage('Verification is temporarily unavailable. Please try again.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (stage === 'factor') {
    return (
      <section className={styles.card} aria-labelledby="login-heading">
        <p className={styles.eyebrow}>Second factor required</p>
        <h1 id="login-heading">Verify it’s you.</h1>
        <p className={styles.description}>
          {reauth
            ? 'Enter a code from your authenticator app to finish the recent sign-in required for this action.'
            : 'Enter a code from your authenticator app to continue to the private editing workspace.'}
        </p>

        <form className={styles.form} onSubmit={handleFactorSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="totp-code">
              {method === 'backup' ? 'Recovery code' : 'Authenticator code'}
            </label>
            <input
              autoComplete={method === 'backup' ? 'off' : 'one-time-code'}
              autoFocus
              id="totp-code"
              inputMode={method === 'backup' ? 'text' : 'numeric'}
              maxLength={method === 'backup' ? 32 : 8}
              name="code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>

          <p className={styles.status} role="status" aria-live="polite">
            {message || 'Codes are single use. Keep recovery codes private.'}
          </p>

          <button
            className={styles.submit}
            type="submit"
            disabled={pending || code.trim().length < 6}
          >
            {pending ? 'Checking…' : 'Verify and continue'}
          </button>
        </form>

        <div className={styles['secondary-actions']}>
          <button
            type="button"
            className={styles['text-button']}
            onClick={() => {
              setMethod(method === 'backup' ? 'totp' : 'backup');
              setCode('');
              setMessage('');
            }}
          >
            {method === 'backup' ? 'Use authenticator code' : 'Use a recovery code'}
          </button>
          <button
            type="button"
            className={styles['text-button']}
            onClick={() => {
              setStage('password');
              setCode('');
              setMessage('');
            }}
          >
            Back to sign in
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="login-heading">
      <p className={styles.eyebrow}>Owner access</p>
      <h1 id="login-heading">{reauth ? 'Sign in again.' : 'Sign in to your studio.'}</h1>
      <p className={styles.description}>
        {reauth
          ? 'Publishing and unpublishing require a password and authenticator sign-in within the last 30 minutes.'
          : 'This private workspace has no public registration. Use the owner account created during setup.'}
      </p>

      <form className={styles.form} onSubmit={handlePasswordSubmit}>
        <div className={styles.field}>
          <label htmlFor="email">Email address</label>
          <input
            autoComplete="username"
            autoFocus
            id="email"
            name="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <input
            autoComplete="current-password"
            id="password"
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <p className={styles.status} role="status" aria-live="polite">
          {message || 'A second factor is required before content can be managed.'}
        </p>

        <button
          className={styles.submit}
          type="submit"
          disabled={pending || !email.trim() || !password}
        >
          {pending ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </section>
  );
}
