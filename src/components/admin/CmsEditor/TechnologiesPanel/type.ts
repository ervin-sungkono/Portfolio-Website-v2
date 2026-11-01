import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { Technologies } from '@/lib/cms/schemas';

export type TechnologiesPanelProps = {
  form: UseFormReturn<Technologies>;
  active: boolean;
  pending: boolean;
  feedback: ReactNode;
  onSave: (data: Technologies) => Promise<void>;
  onClearMessage: () => void;
};
