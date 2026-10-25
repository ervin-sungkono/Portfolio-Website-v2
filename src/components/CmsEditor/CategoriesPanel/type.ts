import type { UseFormReturn } from 'react-hook-form';
import type { Categories } from '@/lib/cms/schemas';
import type { EditorMessage } from '../type';

export type CategoriesPanelProps = {
  form: UseFormReturn<Categories>;
  active: boolean;
  pending: boolean;
  message?: EditorMessage;
  onSave: (data: Categories) => Promise<void>;
  onClearMessage: () => void;
  onReload: () => void;
  onRetry: () => void;
};
