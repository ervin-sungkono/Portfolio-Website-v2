'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import QRCode from 'react-qr-code';
import { authClient } from '@/lib/cms/auth-client';
import styles from './two-factor-setup.module.css';

function readAuthenticatorSecret(uri: string) {
  try {
    const url = new URL(uri);
    const secret = url.searchParams.get('secret') ?? '';
    return url.protocol === 'otpauth:' && url.hostname === 'totp' && /^[A-Z2-7]+=*$/i.test(secret)
      ? secret
      : '';
  } catch {
    return '';
  }
}

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpURI, setTotpURI] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [verified, setVerified] = useState(false);
  const [codesSaved, setCodesSaved] = useState(false);
  const pendingRef = useRef(false);

  async function beginEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    setMessage('');
    try {
      const result = await authClient.twoFactor.enable({
        password,
        issuer: 'Ervin Cahyadinata Sungkono Portfolio CMS',
        method: 'totp',
      });
      if (
        result.error ||
        !result.data ||
        result.data.method !== 'totp' ||
        !result.data.totpURI ||
        result.data.backupCodes.length === 0
      ) {
        setPassword('');
        setMessage('Two-factor setup could not be started. Check your password and try again.');
        return;
      }
      setPassword('');
      setTotpURI(result.data.totpURI);
      setBackupCodes(result.data.backupCodes);
    } catch {
      setPassword('');
      setMessage('Two-factor setup is temporarily unavailable. Please try again.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    setMessage('');
    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: code.trim(),
        trustDevice: false,
      });
      if (result.error) {
        setCode('');
        setMessage(
          'That authenticator code could not be verified. Check the time on your device and try again.',
        );
        return;
      }
      setVerified(true);
      setCode('');
      setMessage(
        'Two-factor verification is complete. Save and confirm your recovery codes before leaving this page.',
      );
    } catch {
      setCode('');
      setMessage('Verification is temporarily unavailable. Please try again.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setMessage('Recovery codes copied. Store them in a private place.');
    } catch {
      setMessage('Clipboard access was unavailable. Select and copy the recovery codes manually.');
    }
  }

  if (enabled && !totpURI) {
    return (
      <section className={styles.panel} aria-labelledby="factor-title">
        <span className={styles['status-icon']} aria-hidden="true">
          ✓
        </span>
        <div>
          <p className={styles.eyebrow}>Account protection</p>
          <h2 id="factor-title">Authenticator is enabled.</h2>
          <p className={styles.copy}>
            This owner account has a verified second factor. Sign-ins will ask for an authenticator
            or recovery code before opening the editor. If you refreshed before saving your one-time
            recovery-code list, use your authenticator to sign in and generate a replacement set
            when needed.
          </p>
          <Link className={styles['primary-link']} href="/admin">
            Return to overview
          </Link>
        </div>
      </section>
    );
  }

  if (totpURI) {
    const secret = readAuthenticatorSecret(totpURI);
    return (
      <section className={styles.panel} aria-labelledby="factor-title">
        <p className={styles.eyebrow}>
          {verified ? 'Setup verified · Save recovery codes' : 'Step 1 of 2 · Add authenticator'}
        </p>
        <h2 id="factor-title">Connect your authenticator app.</h2>
        <p className={styles.copy}>
          Open an authenticator app and add this account. You can use the secure app link or enter
          the setup key manually.
        </p>

        <div className={styles['qr-block']}>
          <div className={styles['qr-frame']} role="img" aria-label="Authenticator setup QR code">
            <QRCode value={totpURI} size={184} level="M" fgColor="#141619" bgColor="#ffffff" />
          </div>
          <p>
            Scan this code with your authenticator app. It is generated on this device and is not
            sent to a QR service.
          </p>
        </div>

        {secret ? (
          <div className={styles['secret-card']}>
            <span className={styles['small-label']}>Setup key</span>
            <code>{secret}</code>
          </div>
        ) : null}
        <a className={styles['app-link']} href={totpURI}>
          Open authenticator app
        </a>

        <div className={styles['recovery-block']}>
          <div className={styles['recovery-heading']}>
            <div>
              <span className={styles['small-label']}>Recovery codes</span>
              <p>Each code works once. Save this list somewhere private before leaving the page.</p>
            </div>
            <button
              className={styles['secondary-button']}
              type="button"
              onClick={copyRecoveryCodes}
            >
              Copy codes
            </button>
          </div>
          <ol className={styles.codes} aria-label="One-time recovery codes">
            {backupCodes.map((backupCode) => (
              <li key={backupCode}>
                <code>{backupCode}</code>
              </li>
            ))}
          </ol>
        </div>

        <p className={styles.message} role="status" aria-live="polite">
          {message}
        </p>

        {verified ? (
          <label className={styles['saved-codes-check']}>
            <input
              type="checkbox"
              checked={codesSaved}
              onChange={(event) => setCodesSaved(event.currentTarget.checked)}
            />
            <span>I saved the recovery codes somewhere private.</span>
          </label>
        ) : null}

        {!verified ? (
          <form className={styles['verify-form']} onSubmit={verifyEnrollment}>
            <div className={styles.field}>
              <label htmlFor="enrollment-code">Step 2 of 2 · Verify a six-digit code</label>
              <input
                autoComplete="one-time-code"
                autoFocus
                id="enrollment-code"
                inputMode="numeric"
                maxLength={8}
                name="code"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <button
              className={styles['primary-button']}
              type="submit"
              disabled={pending || code.trim().length < 6}
            >
              {pending ? 'Verifying…' : 'Verify and finish setup'}
            </button>
          </form>
        ) : null}
        {verified ? (
          <button
            className={styles['finish-button']}
            type="button"
            disabled={!codesSaved}
            onClick={() => {
              router.push('/admin');
              router.refresh();
            }}
          >
            Continue to the editor
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="factor-title">
      <p className={styles.eyebrow}>Account protection</p>
      <h2 id="factor-title">Add a second factor before editing.</h2>
      <p className={styles.copy}>
        The private editor requires password sign-in and an authenticator code. Confirm your
        password to create a TOTP setup key and one-time recovery codes.
      </p>

      <form className={styles['verify-form']} onSubmit={beginEnrollment}>
        <div className={styles.field}>
          <label htmlFor="confirm-password">Confirm owner password</label>
          <input
            autoComplete="current-password"
            autoFocus
            id="confirm-password"
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <p className={styles.message} role="status" aria-live="polite">
          {message || 'Once generated, recovery codes stay on this page until you continue.'}
        </p>
        <button className={styles['primary-button']} type="submit" disabled={pending || !password}>
          {pending ? 'Preparing setup…' : 'Set up authenticator'}
        </button>
      </form>
    </section>
  );
}
