import type { Design } from '@/lib/content';

export type DesignCollectionProps = {
  designs: readonly Design[];
  unavailable?: boolean;
};
