import type { UseFormReturn } from 'react-hook-form';
import type { ProjectDocument } from '@/lib/cms/schemas';
import type { CmsSnapshot, EditorMessage } from '../type';

export type ProjectPanelProps = {
  form: UseFormReturn<ProjectDocument>;
  snapshot: CmsSnapshot;
  active: boolean;
  selectedSlug: string;
  newSlug: string;
  pending: boolean;
  message?: EditorMessage;
  onSelectedSlugChange: (slug: string) => void;
  onNewSlugChange: (slug: string) => void;
  onSave: (data: ProjectDocument) => Promise<void>;
  onDelete: () => void;
  onClearMessage: () => void;
  onReload: () => void;
  onRetry: () => void;
};
