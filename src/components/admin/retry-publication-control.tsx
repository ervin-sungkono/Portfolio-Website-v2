'use client';

import { useRef, useState } from 'react';
import { retryPendingPublicationAction } from '@/lib/cms/actions';
import styles from './retry-publication-control.module.css';

export function RetryPublicationControl({ pendingCount }: { pendingCount: number }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const pendingRef = useRef(false);

  async function retry() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setMessage('');
    try {
      const result = await retryPendingPublicationAction();
      setMessage(result.message);
      setError(!result.ok);
    } catch {
      setMessage('The retry could not be completed. Try again shortly.');
      setError(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className={styles.control}>
      <p>
        {pendingCount} event{pendingCount === 1 ? '' : 's'} waiting
      </p>
      <button type="button" onClick={retry} disabled={pending}>
        {pending ? 'Refreshing…' : 'Retry refresh'}
      </button>
      {message ? (
        <span className={error ? styles.error : styles.success} role={error ? 'alert' : 'status'}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
