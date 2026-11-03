import type { Project } from '@/lib/content';

export type ProjectGalleryProps = {
  project: Pick<Project, 'name' | 'image' | 'gallery'>;
};
