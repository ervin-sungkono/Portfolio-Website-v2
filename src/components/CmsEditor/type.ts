import type { Categories, ProjectDocument, SiteDocument, Technologies } from '@/lib/cms/schemas';

export type CmsSection = 'projects' | 'site' | 'categories' | 'technologies' | 'images';

export type FieldErrorProps = { id: string; message?: string };

export type CmsSnapshot = {
  repository: { owner: string; name: string; defaultBranch: string };
  site: { data: SiteDocument; sha: string };
  categories: { data: Categories; sha: string };
  technologies: { data: Technologies; sha: string };
  projects: Array<{ slug: string; data: ProjectDocument; sha: string }>;
};

export type CmsWriteRequest =
  | { kind: 'project'; slug: string; expectedSha: string | null; data: ProjectDocument }
  | { kind: 'site'; expectedSha: string; data: SiteDocument }
  | { kind: 'categories'; expectedSha: string; data: Categories }
  | { kind: 'technologies'; expectedSha: string; data: Technologies }
  | { kind: 'delete-project'; slug: string; expectedSha: string }
  | { kind: 'revalidate'; target: 'project' | 'site' | 'taxonomy'; slug?: string };

export type EditorMessage = {
  tone: 'success' | 'error' | 'conflict';
  text: string;
  commitUrl?: string;
  cache?: 'refreshed' | 'pending';
  conflictSlug?: string;
  revalidateTarget?: 'project' | 'site' | 'taxonomy';
  revalidateSlug?: string;
};

export type CmsApiReply = {
  error?: string;
  message?: string;
  commitUrl?: string;
  sha?: string;
  cache?: 'refreshed' | 'pending';
  path?: string;
};

export type ImageUploadResult = {
  path: string;
  commitUrl: string;
  scope: 'project' | 'technology';
  slug: string;
};

export type LoadState = 'loading' | 'ready' | 'needs-initialization' | 'error';
export type BusySection = CmsSection | 'initialize' | null;
