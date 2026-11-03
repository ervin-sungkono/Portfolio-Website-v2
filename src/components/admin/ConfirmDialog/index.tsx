'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Confirmation } from './type';
import './style.css';

export function useConfirmDialog() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const resolve = useRef<((accepted: boolean) => void) | null>(null);

  const confirm = useCallback((options: Confirmation) => {
    if (resolve.current) {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((done) => {
      resolve.current = done;
      setConfirmation(options);
    });
  }, []);

  function finish(accepted: boolean) {
    const done = resolve.current;
    resolve.current = null;
    if (dialog.current?.open) {
      dialog.current.close();
    }
    setConfirmation(null);
    done?.(accepted);
  }

  useEffect(() => {
    if (confirmation && !dialog.current?.open) {
      dialog.current?.showModal();
      cancel.current?.focus();
    }
  }, [confirmation]);

  useEffect(
    () => () => {
      const done = resolve.current;
      resolve.current = null;
      done?.(false);
    },
    [],
  );

  const confirmationDialog = (
    <dialog
      ref={dialog}
      className="cms-confirm-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        finish(false);
      }}
      onClose={() => {
        if (resolve.current) {
          finish(false);
        }
      }}
    >
      {confirmation && (
        <>
          <h2 id={`${id}-title`}>{confirmation.title}</h2>
          <p id={`${id}-description`}>{confirmation.description}</p>
          <div className="cms-confirm-actions">
            <button
              ref={cancel}
              type="button"
              className="button button-outline"
              onClick={() => finish(false)}
            >
              Cancel
            </button>
            <button type="button" className="button" onClick={() => finish(true)}>
              {confirmation.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </>
      )}
    </dialog>
  );

  return { confirm, confirmationDialog };
}
