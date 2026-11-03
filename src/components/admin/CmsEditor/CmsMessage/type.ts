import type { EditorMessage } from '../type';

export type CmsMessageProps = {
  message?: EditorMessage;
  onDismiss?: () => void;
};
