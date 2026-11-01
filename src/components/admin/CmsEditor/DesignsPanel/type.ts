import type { CmsApiReply } from '../type';
import type { ReactNode } from 'react';

export type DribbbleShot = {
  id: string;
  title: string;
  url: string;
  image: string;
};

export type DesignsPanelProps = {
  active: boolean;
  pending: boolean;
  feedback: ReactNode;
  onSave: (selection: { expectedSha: string; designs: string[] }) => Promise<CmsApiReply | null>;
  onClearMessage: () => void;
  onDirtyChange: (dirty: boolean) => void;
};
