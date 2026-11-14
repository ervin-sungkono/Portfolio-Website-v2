import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { CmsSnapshot, ProjectDocument } from '@/lib/cms/schemas';

export type ProjectPanelProps = {
  form: UseFormReturn<ProjectDocument>;
  snapshot: CmsSnapshot;
  active: boolean;
  selectedSlug: string;
  newSlug: string;
  pending: boolean;
  feedback: ReactNode;
  allowDelete?: boolean;
  openButtonLabel?: string;
  showImportLink?: boolean;
  onSelectedSlugChange: (slug: string) => Promise<boolean>;
  onNewSlugChange: (slug: string) => void;
  onSave: (data: ProjectDocument) => Promise<void>;
  onDelete: () => Promise<boolean>;
  onClearMessage: () => void;
};
