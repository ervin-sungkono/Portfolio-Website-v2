import type { UseFormReturn } from 'react-hook-form';
import type { Technologies } from '@/lib/cms/schemas';
import type { EditorMessage } from '../type';

export type TechnologiesPanelProps = {
  form: UseFormReturn<Technologies>;
  active: boolean;
  pending: boolean;
  message?: EditorMessage;
  onSave: (data: Technologies) => Promise<void>;
  onClearMessage: () => void;
  onReload: () => void;
  onRetry: () => void;
};
