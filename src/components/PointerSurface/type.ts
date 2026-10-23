import type { PointerEvent, ReactNode } from 'react';

export type PointerSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export type SurfacePointerEvent = PointerEvent<HTMLDivElement>;
