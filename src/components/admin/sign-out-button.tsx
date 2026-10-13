'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { authClient } from '@/lib/cms/auth-client';
import styles from './sign-out-button.module.css';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const pendingRef = useRef(false);

  async function signOut() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError('');
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError('Sign out could not be completed. Please try again.');
        return;
      }
      router.replace('/admin/login');
      router.refresh();
    } catch {
      setError('Sign out could not be completed. Please try again.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <span className={styles.wrapper}>
      <button className={styles.button} type="button" onClick={signOut} disabled={pending}>
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      {error ? (
        <span className={styles.error} role="status">
          {error}
        </span>
      ) : null}
    </span>
  );
}
