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
  onClearMessage: () => void;
};
