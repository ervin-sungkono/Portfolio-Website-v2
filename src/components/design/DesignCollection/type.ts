import type { Design } from '@/lib/content';

export type DesignCollectionProps = {
  activeCategory: string;
  categories: string[];
  filtered: readonly Design[];
};
