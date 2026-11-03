import type { ReactNode } from 'react';

export type ScrollHeroProps = {
  children: ReactNode;
  slides: ReadonlyArray<{ id: string; content: ReactNode }>;
};
