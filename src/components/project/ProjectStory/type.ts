import type { Project } from '@/lib/content';
import type { ProjectStudy } from '@/lib/cms/schemas';

export type ProjectStoryProps = {
  project: Project;
  study?: ProjectStudy;
};
