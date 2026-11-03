import { safeCommitUrl } from '../utils';
import type { CmsMessageProps } from './type';
import './style.css';

export function CmsMessage({ message, onRetry, onDismiss, pending = false }: CmsMessageProps) {
  if (!message) {
    return null;
  }

  const role = message.tone === 'success' ? 'status' : 'alert';
  const commitUrl = message.commitUrl ? safeCommitUrl(message.commitUrl) : undefined;

  return (
    <div className={`cms-editor-message cms-editor-message-${message.tone} cms-toast`} role={role}>
      <p>{message.text}</p>
      {commitUrl && (
        <a href={commitUrl} target="_blank" rel="noreferrer">
          View GitHub commit
        </a>
      )}
      {message.cache === 'pending' && onRetry && (
        <button
          type="button"
          className="cms-editor-text-button"
          onClick={onRetry}
          disabled={pending}
        >
          Retry public refresh
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          className="cms-editor-text-button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
