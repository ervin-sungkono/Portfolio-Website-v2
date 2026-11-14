import type { ReactNode } from 'react';

export type DesignsPanelProps = {
  active: boolean;
  pending: boolean;
  feedback: ReactNode;
  onClearMessage: () => void;
};
