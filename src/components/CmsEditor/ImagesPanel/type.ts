import type { UseFormReturn } from 'react-hook-form';
import type { ProjectDocument, Technologies } from '@/lib/cms/schemas';
import type { EditorMessage, ImageUploadResult } from '../type';

export type ImagesPanelProps = {
  projectForm: UseFormReturn<ProjectDocument>;
  technologiesForm: UseFormReturn<Technologies>;
  selectedProjectSlug: string;
  newProjectSlug: string;
  active: boolean;
  pending: boolean;
  message?: EditorMessage;
  result?: ImageUploadResult;
  onUpload: (file: File, slug: string, scope: 'project' | 'technology') => Promise<void>;
  onClearMessage: () => void;
  onReload: () => void;
  onRetry: () => void;
};
