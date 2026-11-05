import type { ReactNode } from 'react';

export type Confirmation = {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  details?: ReactNode;
};
