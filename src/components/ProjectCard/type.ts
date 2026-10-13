import type { Project, ProjectStudy } from '@/lib/content';

export type ProjectCardProps = {
  project: Project;
  study?: ProjectStudy;
  featured?: boolean;
  headingLevel?: 2 | 3;
  index?: number;
  sizes?: string;
  parallaxTravel?: 1 | 1.25 | 1.5 | 2;
};
