import type { CmsMessageProps } from './type';
import './style.css';

function safeCommitUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function CmsMessage({ message, onReload, onRetry, pending = false }: CmsMessageProps) {
  if (!message) {
    return null;
  }

  const role = message.tone === 'success' ? 'status' : 'alert';
  const commitUrl = message.commitUrl ? safeCommitUrl(message.commitUrl) : undefined;

  return (
    <div className={`cms-editor-message cms-editor-message-${message.tone}`} role={role}>
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
      {message.tone === 'conflict' && onReload && (
        <button
          type="button"
          className="cms-editor-text-button"
          onClick={onReload}
          disabled={pending}
        >
          Reload repository version and discard this draft
        </button>
      )}
    </div>
  );
}
