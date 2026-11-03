import type { Project } from '@/lib/content';

export type ProjectCardProps = {
  project: Project;
  featured?: boolean;
  index?: number;
  sizes?: string;
  parallaxTravel?: 1 | 1.25 | 1.5 | 2;
};
