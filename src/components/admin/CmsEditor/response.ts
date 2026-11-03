import { categoriesSchema, projectSchema, siteSchema, technologiesSchema } from '@/lib/cms/schemas';
import type { CmsSnapshot } from './type';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function errorFrom(value: unknown) {
  if (isRecord(value)) {
    return typeof value.error === 'string' ? value.error : '';
  }
  return '';
}

export async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

export function parseSnapshot(value: Record<string, unknown>): CmsSnapshot {
  const repository = value.repository;
  const site = value.site;
  const categories = value.categories;
  const technologies = value.technologies;
  const projects = value.projects;

  if (
    !isRecord(repository) ||
    typeof repository.owner !== 'string' ||
    typeof repository.name !== 'string' ||
    typeof repository.defaultBranch !== 'string' ||
    !isRecord(site) ||
    typeof site.sha !== 'string' ||
    !isRecord(categories) ||
    typeof categories.sha !== 'string' ||
    !isRecord(technologies) ||
    typeof technologies.sha !== 'string' ||
    !Array.isArray(projects)
  ) {
    throw new Error('The CMS returned an incomplete content snapshot.');
  }

  return {
    repository: {
      owner: repository.owner,
      name: repository.name,
      defaultBranch: repository.defaultBranch,
    },
    site: { data: siteSchema.parse(site.data), sha: site.sha },
    categories: { data: categoriesSchema.parse(categories.data), sha: categories.sha },
    technologies: { data: technologiesSchema.parse(technologies.data), sha: technologies.sha },
    projects: projects.map((entry) => {
      if (
        !isRecord(entry) ||
        typeof entry.slug !== 'string' ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) ||
        typeof entry.sha !== 'string'
      ) {
        throw new Error('The CMS returned an invalid project entry.');
      }
      return { slug: entry.slug, data: projectSchema.parse(entry.data), sha: entry.sha };
    }),
  };
}
