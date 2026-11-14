import type {
  Categories,
  PostDocument,
  ProjectDocument,
  SiteDocument,
  Technologies,
} from '@/lib/cms/schemas';

export type DraftDocument<T> = { expectedSha: string; data: T };
export type DraftProject = { slug: string; expectedSha: string | null; data: ProjectDocument };
export type DraftMedia = {
  scope: 'project' | 'technology';
  slug: string;
  filename: string;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  path: string;
};
export type DraftMediaDeletion = { path: string; expectedSha: string };

export type CmsDraft = {
  repository: string;
  projects: { upsert: DraftProject[]; delete: { slug: string; expectedSha: string }[] };
  posts?: {
    upsert: Array<{ slug: string; expectedSha: string | null; data: PostDocument }>;
    delete: Array<{ slug: string; expectedSha: string }>;
  };
  site?: DraftDocument<SiteDocument>;
  categories?: DraftDocument<Categories>;
  technologies?: DraftDocument<Technologies>;
  designs?: { expectedSha: string; designs: string[] };
  media: DraftMedia[];
  deleteMedia?: DraftMediaDeletion[];
  newProject?: { slug: string; data: ProjectDocument };
  newPost?: { slug: string; data: PostDocument };
  pendingRefresh?: { commitUrl?: string };
};

export function emptyDraft(repository = ''): CmsDraft {
  return { repository, projects: { upsert: [], delete: [] }, media: [] };
}
