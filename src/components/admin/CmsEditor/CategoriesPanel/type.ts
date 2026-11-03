import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { Categories } from '@/lib/cms/schemas';

export type CategoriesPanelProps = {
  form: UseFormReturn<Categories>;
  active: boolean;
  pending: boolean;
  feedback: ReactNode;
  onSave: (data: Categories) => Promise<void>;
  onClearMessage: () => void;
};
