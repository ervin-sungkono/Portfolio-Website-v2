import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { PostDocument } from '@/lib/cms/schemas';
import type { CmsSnapshot } from '../type';

export type PostsPanelProps = {
  form: UseFormReturn<PostDocument>;
  snapshot: CmsSnapshot;
  active: boolean;
  selectedSlug: string;
  newSlug: string;
  pending: boolean;
  feedback: ReactNode;
  onSelectedSlugChange: (slug: string) => Promise<boolean>;
  onNewSlugChange: (slug: string) => void;
  onSave: (data: PostDocument) => Promise<void>;
  onDelete: (slug: string) => Promise<boolean>;
  onClearMessage: () => void;
};
