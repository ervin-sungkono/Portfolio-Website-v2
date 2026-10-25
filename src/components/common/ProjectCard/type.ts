import type { Project } from '@/lib/content';

export type ProjectCardProps = {
  project: Project;
  featured?: boolean;
  headingLevel?: 2 | 3;
  index?: number;
  sizes?: string;
  parallaxTravel?: 1 | 1.25 | 1.5 | 2;
};
