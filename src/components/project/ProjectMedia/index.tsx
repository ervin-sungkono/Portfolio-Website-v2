import { ProjectGallery } from '@/components/project/ProjectGallery';
import type { ProjectMediaProps } from './type';

export function ProjectMedia({ project }: ProjectMediaProps) {
  return <ProjectGallery project={project} />;
}
