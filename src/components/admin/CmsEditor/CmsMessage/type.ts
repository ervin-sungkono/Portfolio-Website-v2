import type { EditorMessage } from '../type';

export type CmsMessageProps = {
  message?: EditorMessage;
  onRetry?: () => void;
  onDismiss?: () => void;
  pending?: boolean;
};
