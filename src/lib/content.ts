import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { connection } from 'next/server';
import projectData from '@/content/projects.json';
import designData from '@/content/designs.json';
import { profile as profileSnapshot, skills as skillSnapshot } from '@/content/profile';
import {
  projectStudies as studySnapshot,
  engineeringCapabilities,
  portfolioDecisions,
  portfolioFileUrl,
  portfolioSource,
  portfolioSourceRef,
} from '@/content/engineering';
import type { ProjectStudy as SiteProjectStudy } from '@/content/engineering';
import { CmsInvariantError } from '@/lib/cms/errors';
import { getPublishedCacheScope } from '@/lib/cms/cache-scope';
import { publicName } from '@/lib/metadata';
import {
  validatePayload,
  type CmsKind,
  type DesignPayload,
  type ProfilePayload,
  type ProjectPayload,
  type Skill,
} from '@/lib/cms/model';

export type Project = Omit<ProjectPayload, 'demo' | 'study'> & { demo?: string | null };
export type ProjectStudy = SiteProjectStudy;
export type Design = DesignPayload;
export type { ProfilePayload, Skill };

export type PublishedContent = {
  projects: Project[];
  designs: Design[];
  profile: ProfilePayload;
  skills: Skill[];
  projectStudies: Record<string, ProjectStudy>;
};

const staticProjects: Project[] = projectData.map((project) => ({ ...project }));
const staticDesigns: Design[] = designData;
const staticProfile: ProfilePayload = {
  ...profileSnapshot,
  skills: skillSnapshot,
};
const staticProjectStudies: Record<string, ProjectStudy> = {};
for (const [slug, study] of Object.entries(studySnapshot)) {
  if (study) staticProjectStudies[slug] = study;
}

const unpublishedProfile: ProfilePayload = {
  name: publicName,
  title: '',
  linkedin: '',
  github: '',
  dribbble: '',
  instagram: '',
  cv: '',
  intro: '',
  experiences: [],
  education: { school: '', degree: '', years: '' },
  skills: [],
};

const readCachedPublishedEntries = unstable_cache(
  async (cacheScope: string) => {
    // unstable_cache includes function arguments in the key. The scope partitions
    // persistent cache entries by database endpoint and deployment environment.
    void cacheScope;
    const { readPublishedEntries } = await import('@/lib/cms/store');
    return readPublishedEntries();
  },
  ['cms-published-content-v2'],
  { revalidate: 60, tags: ['cms:published'] },
);

function contentSource(): 'static' | 'database' {
  const source = process.env.CMS_CONTENT_SOURCE || 'static';
  if (source === 'static' || source === 'database') return source;
  throw new Error('CMS_CONTENT_SOURCE must be either "static" or "database".');
}

function fromPublishedEntries(
  entries: Awaited<ReturnType<typeof readCachedPublishedEntries>>,
): PublishedContent {
  const projects: Project[] = [];
  const designs: Design[] = [];
  const projectStudies: Record<string, ProjectStudy> = {};
  let publishedProfile: ProfilePayload | undefined;

  for (const entry of [...entries].sort(
    (a, b) => a.position - b.position || a.slug.localeCompare(b.slug),
  )) {
    switch (entry.kind as CmsKind) {
      case 'project': {
        const payload = validatePayload('project', entry.payload) as ProjectPayload;
        if (payload.slug !== entry.slug) {
          throw new CmsInvariantError('Published project slug does not match its catalog entry.');
        }
        const { study, ...project } = payload;
        projects.push(project);
        if (study) projectStudies[entry.slug] = study;
        break;
      }
      case 'design': {
        const payload = validatePayload('design', entry.payload) as DesignPayload;
        if (payload.id !== entry.slug) {
          throw new CmsInvariantError('Published design id does not match its catalog entry.');
        }
        designs.push(payload);
        break;
      }
      case 'profile': {
        if (entry.slug !== 'profile' || publishedProfile) {
          throw new CmsInvariantError('The published profile entry is invalid.');
        }
        publishedProfile = validatePayload('profile', entry.payload) as ProfilePayload;
        break;
      }
      default:
        throw new CmsInvariantError('Published content has an unsupported type.');
    }
  }

  return {
    projects,
    designs,
    profile: publishedProfile ?? unpublishedProfile,
    skills: publishedProfile?.skills ?? [],
    projectStudies,
  };
}

function snapshotContent(): PublishedContent {
  return {
    projects: staticProjects,
    designs: staticDesigns,
    profile: staticProfile,
    skills: staticProfile.skills,
    projectStudies: staticProjectStudies,
  };
}

export const getPublishedContent = cache(async (): Promise<PublishedContent> => {
  // Resolve the configured source on requests in both modes. A build created
  // before database setup must not keep serving prerendered snapshots after the
  // runtime explicitly switches to database mode.
  await connection();
  if (contentSource() === 'static') return snapshotContent();

  // Database access stays out of builds; cache only the public projection.
  const entries = await readCachedPublishedEntries(getPublishedCacheScope());
  return fromPublishedEntries(entries);
});

export async function getProjects(): Promise<Project[]> {
  return (await getPublishedContent()).projects;
}

export async function getDesigns(): Promise<Design[]> {
  return (await getPublishedContent()).designs;
}

export async function getProfile(): Promise<ProfilePayload> {
  return (await getPublishedContent()).profile;
}

export async function getFeaturedProjects(): Promise<Project[]> {
  return (await getProjects()).slice(0, 3);
}

export async function findProject(slug: string): Promise<Project | undefined> {
  return (await getProjects()).find((project) => project.slug === slug);
}

export async function getProjectStudies(): Promise<Record<string, ProjectStudy>> {
  return (await getPublishedContent()).projectStudies;
}

export async function filterProjects(
  query: string,
  category: string,
  source?: Project[],
): Promise<Project[]> {
  const projects = source ?? (await getProjects());
  const term = query.trim().toLowerCase();
  return projects.filter(
    (project) =>
      (!category || project.category === category) &&
      (!term ||
        `${project.name} ${project.description} ${project.topics.join(' ')}`
          .toLowerCase()
          .includes(term)),
  );
}

export async function relatedProjects(
  project: Project,
  limit = 2,
  source?: Project[],
): Promise<Project[]> {
  const projects = source ?? (await getProjects());
  return projects
    .filter((candidate) => candidate.slug !== project.slug)
    .map((candidate) => ({
      project: candidate,
      score:
        candidate.topics.filter((topic) => project.topics.includes(topic)).length * 2 +
        Number(candidate.category === project.category),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ project: candidate }) => candidate);
}

export function getStaticProjectSlugs(): string[] {
  return contentSource() === 'static' ? staticProjects.map(({ slug }) => slug) : [];
}

// Engineering notes are site-authored content; project and profile lookups still use this boundary.
export {
  engineeringCapabilities,
  portfolioDecisions,
  portfolioFileUrl,
  portfolioSource,
  portfolioSourceRef,
};
