import type { UseFormReturn } from 'react-hook-form';
import type { SiteDocument } from '@/lib/cms/schemas';
import type { EditorMessage } from '../type';

export type SiteProfilePanelProps = {
  form: UseFormReturn<SiteDocument>;
  active: boolean;
  pending: boolean;
  message?: EditorMessage;
  onSave: (data: SiteDocument) => Promise<void>;
  onClearMessage: () => void;
  onReload: () => void;
  onRetry: () => void;
};
