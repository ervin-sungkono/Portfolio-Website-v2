import { getPublicContent } from '@/lib/cms/public';
import type { ProjectStudy } from '@/lib/cms/schemas';
import { getDribbbleDesigns, type DribbbleShot } from '@/lib/dribbble';
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
  study?: ProjectStudy;
};
export type Design = DribbbleShot;

export async function getProjects(): Promise<readonly Project[]> {
  return (await getPublicContent()).projects;
}

export async function getPortfolio() {
  return (await getPublicContent()).portfolio;
}

async function getCachedDesigns(): Promise<readonly Design[]> {
  'use cache';
  cacheTag('portfolio', 'designs');
  cacheLife({ stale: 300, revalidate: Infinity, expire: Infinity });

  const { designs } = await getPortfolio();
  return getDribbbleDesigns(designs);
}

export async function getDesigns(): Promise<readonly Design[]> {
  return getCachedDesigns();
}

export function selectFeaturedProjects(projects: readonly Project[]) {
  return projects.filter((project, index) => project.featured ?? index < 3).slice(0, 3);
}

export async function findProject(slug: string) {
  'use cache';
  cacheTag(`project:${slug}`, 'projects', 'taxonomy');
  cacheLife({ stale: 300, revalidate: Infinity, expire: Infinity });
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
  return (await getPublicContent()).site;
}
