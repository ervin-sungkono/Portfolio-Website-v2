import type { Project } from '@/lib/content';

export type ProjectCollectionProps = {
  projects: readonly Project[];
  featuredProjects: readonly Project[];
  filtered: readonly Project[];
  isUnfiltered: boolean;
};
