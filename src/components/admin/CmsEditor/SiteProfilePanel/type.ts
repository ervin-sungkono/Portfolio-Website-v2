import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { CmsSnapshot, SiteDocument } from '@/lib/cms/schemas';

export type SiteProfilePanelProps = {
  form: UseFormReturn<SiteDocument>;
  projects: CmsSnapshot['projects'];
  active: boolean;
  pending: boolean;
  feedback: ReactNode;
  onSave: (data: SiteDocument) => Promise<void>;
  onClearMessage: () => void;
};
