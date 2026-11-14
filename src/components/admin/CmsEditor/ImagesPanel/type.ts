import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { CmsSnapshot, ProjectDocument, Technologies } from '@/lib/cms/schemas';

export type ImageUploadTarget = {
  kind: 'project' | 'technology';
  projectSlug?: string;
};

export type ImagesPanelProps = {
  projectForm: UseFormReturn<ProjectDocument>;
  technologiesForm: UseFormReturn<Technologies>;
  selectedProjectSlug: string;
  newProjectSlug: string;
  snapshot?: CmsSnapshot;
  onEditReferences?: (kind: 'project' | 'technology', slug?: string) => void;
  projectOnly?: boolean;
  canUpload?: boolean;
  active: boolean;
  pending: boolean;
  feedback: ReactNode;
  onUpload: (
    file: File,
    target: ImageUploadTarget,
  ) => Promise<{ path: string; alreadyExists?: boolean }>;
  onClearMessage: () => void;
};
