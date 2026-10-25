import projectData from '@/content/projects.json';
import designData from '@/content/designs.json';
import { getPublicContent } from '@/lib/cms/public';
import { profile } from '@/content/profile';
import { site } from '@/lib/metadata';
import { cacheLife, cacheTag } from 'next/cache';

export type Project = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  topics: string[];
  category: string;
  source: string | null;
  demo: string | null;
  featured?: boolean;
  details?: string;
  gallery?: string[];
  categories?: string[];
  tags?: string[];
};
export type Design = (typeof designData)[number];

export const designs: readonly Design[] = designData;

export async function getProjects(): Promise<readonly Project[]> {
  const remote = await getPublicContent();
  return remote?.projects ?? projectData;
}

export async function getProjectCategories(): Promise<readonly string[]> {
  const remote = await getPublicContent();
  if (remote) {
    return remote.categories;
  }
  const projects: readonly Project[] = projectData;
  return [...new Set(projects.flatMap((project) => project.categories ?? [project.category]))];
}

export function selectFeaturedProjects(projects: readonly Project[]) {
  return projects.filter((project, index) => project.featured ?? index < 3).slice(0, 3);
}

export async function findProject(slug: string) {
  'use cache';
  cacheTag(`project:${slug}`, 'projects', 'taxonomy');
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  return (await getProjects()).find((project) => project.slug === slug);
}

export function filterProjects(projects: readonly Project[], query: string, category: string) {
  const term = query.trim().toLowerCase();
  return projects.filter(
    (project) =>
      (!category || (project.categories ?? [project.category]).includes(category)) &&
      (!term ||
        `${project.name} ${project.description} ${project.topics.join(' ')} ${(project.tags ?? []).join(' ')}`
          .toLowerCase()
          .includes(term)),
  );
}

// Public content exports keep pages independent of the storage format.
export {
  projectStudies,
  engineeringCapabilities,
  portfolioDecisions,
  portfolioFileUrl,
  portfolioSource,
  portfolioSourceRef,
} from '@/content/engineering';

export function relatedProjects(projects: readonly Project[], project: Project, limit = 2) {
  // Shared technologies take priority, followed by projects in the same category.
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

export async function getSiteContent() {
  const remote = await getPublicContent();
  return (
    remote?.site ?? {
      schemaVersion: 1 as const,
      siteTitle: site.title,
      headline: 'Frontend Engineering.\nFrom UI to Integration.',
      introduction: `I’m ${profile.name}, a software engineer at Samsung R&D Institute Indonesia with a focus on frontend development and interface design.`,
      socialLinks: [],
    }
  );
}
