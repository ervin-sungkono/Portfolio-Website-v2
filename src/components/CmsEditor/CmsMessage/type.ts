import type { EditorMessage } from '../type';

export type CmsMessageProps = {
  message?: EditorMessage;
  onReload?: () => void;
  onRetry?: () => void;
  pending?: boolean;
};
