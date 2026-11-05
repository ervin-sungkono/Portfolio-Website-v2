import { Button } from '@/components/common/Button';
import { safeCommitUrl } from '../utils';
import type { CmsMessageProps } from './type';
import './style.css';

export function CmsMessage({ message, onDismiss }: CmsMessageProps) {
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
      {onDismiss && (
        <Button
          kind="action"
          type="button"
          className="cms-editor-text-button"
          variant="text"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          Dismiss
        </Button>
      )}
    </div>
  );
}
