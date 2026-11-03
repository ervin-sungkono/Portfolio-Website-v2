import type { Categories, ProjectDocument, SiteDocument, Technologies } from '@/lib/cms/schemas';

export type CmsSection = 'projects' | 'site' | 'categories' | 'technologies' | 'designs' | 'images';

export type FieldErrorProps = { id: string; message?: string };

export type CmsSnapshot = {
  repository: { owner: string; name: string; defaultBranch: string };
  site: { data: SiteDocument; sha: string };
  categories: { data: Categories; sha: string };
  technologies: { data: Technologies; sha: string };
  projects: Array<{ slug: string; data: ProjectDocument; sha: string }>;
};

export type EditorMessage = {
  tone: 'success' | 'error' | 'conflict';
  text: string;
  commitUrl?: string;
};

export type LoadState = 'loading' | 'ready' | 'needs-initialization' | 'error';
export type BusySection = CmsSection | 'initialize' | 'submit' | null;
