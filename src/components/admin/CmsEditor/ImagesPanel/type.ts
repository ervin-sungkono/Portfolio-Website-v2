import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { ProjectDocument, Technologies } from '@/lib/cms/schemas';
import type { ImageUploadResult } from '../type';

export type ImagesPanelProps = {
  projectForm: UseFormReturn<ProjectDocument>;
  technologiesForm: UseFormReturn<Technologies>;
  selectedProjectSlug: string;
  newProjectSlug: string;
  projectOnly?: boolean;
  active: boolean;
  pending: boolean;
  feedback: ReactNode;
  result?: ImageUploadResult;
  onUpload: (file: File, slug: string, scope: 'project' | 'technology') => Promise<void>;
  onClearMessage: () => void;
};
