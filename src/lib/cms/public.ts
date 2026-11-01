import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';
import type { Project } from '../content.ts';
import { CmsError } from './errors.ts';
import { getGitHubPat, githubBytes } from './github.ts';
import { resolveRepository } from './repository.ts';
import {
  categoriesSchema,
  portfolioSchema,
  projectIndexSchema,
  projectSchema,
  siteSchema,
  technologiesSchema,
} from './schemas.ts';

function mediaUrl(owner: string, name: string, branch: string, path: string) {
  return `https://raw.githubusercontent.com/${[owner, name, branch, ...path.split('/')].map(encodeURIComponent).join('/')}`;
}

async function currentCommit(owner: string, name: string, branch: string) {
  const feed = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${encodeURIComponent(branch)}.atom`;
  let response: Response;
  try {
    response = await fetch(feed, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new CmsError('unavailable', 'Could not reach the published content repository.', 503);
  }
  if (!response.ok) {
    throw new CmsError('unavailable', 'Could not read the published content revision.', 503);
  }
  const xml = await response.text();
  const commit = /<entry>\s*<id>tag:github\.com,2008:Grit::Commit\/([a-f0-9]{40})<\/id>/.exec(
    xml,
  )?.[1];
  if (!commit || xml.length > 1_000_000) {
    throw new CmsError('unavailable', 'GitHub returned an invalid content revision.', 503);
  }
  return commit;
}

async function readPublicContent(owner: string, name: string, branch: string) {
  'use cache';
  cacheTag('projects', 'site', 'taxonomy', 'portfolio');
  cacheLife({ stale: 300, revalidate: Infinity, expire: Infinity });

  // Resolve the branch once per build or invalidation, then read one immutable revision.
  const revision = await currentCommit(owner, name, branch);
  async function readDocument<T>(
    path: string,
    schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  ): Promise<T> {
    const bytes = await githubBytes(mediaUrl(owner, name, revision, path));
    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(bytes).toString('utf8'));
    } catch {
      throw new CmsError('unsupported_repository', `Invalid JSON at ${path}.`, 409);
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success || parsed.data === undefined) {
      throw new CmsError('unsupported_repository', `Invalid published content at ${path}.`, 409);
    }
    return parsed.data;
  }

  const [site, portfolio, categories, technologies, index] = await Promise.all([
    readDocument('content/site.json', siteSchema),
    readDocument('content/portfolio.json', portfolioSchema),
    readDocument('content/categories.json', categoriesSchema),
    readDocument('content/technologies.json', technologiesSchema),
    readDocument('content/project-index.json', projectIndexSchema),
  ]);
  const documents = await Promise.all(
    index.projects.map(async (slug) => ({
      slug,
      data: await readDocument(`content/projects/${slug}.json`, projectSchema),
    })),
  );
  const projects: Project[] = documents
    .filter(({ data }) => data.published)
    .sort((a, b) => a.data.sortOrder - b.data.sortOrder || a.slug.localeCompare(b.slug))
    .map(({ slug, data }) => {
      if (
        data.categories.some((id) => !Object.hasOwn(categories, id)) ||
        data.technologies.some((id) => !Object.hasOwn(technologies, id)) ||
        [data.media.cover, ...data.media.gallery].some(
          (path) => !path.startsWith(`media/projects/${slug}/`),
        )
      ) {
        throw new CmsError(
          'unsupported_repository',
          `Project ${slug} has invalid references.`,
          409,
        );
      }
      return {
        id: slug,
        slug,
        name: data.title,
        description: data.summary,
        details: data.description,
        image: mediaUrl(owner, name, revision, data.media.cover),
        gallery: data.media.gallery.map((path) => mediaUrl(owner, name, revision, path)),
        topics: data.technologies.map((id) => technologies[id].label),
        category: data.categories.map((id) => categories[id].label).join(' / '),
        categories: data.categories.map((id) => categories[id].label),
        tags: data.tags,
        source: data.links.source ?? null,
        demo: data.links.demo ?? null,
        featured: data.featured,
        study: portfolio.projectStudies[slug],
      };
    });
  return { projects, site, portfolio };
}

async function publicRepository() {
  'use cache';
  cacheTag('content-source');
  cacheLife({ stale: 300, revalidate: Infinity, expire: Infinity });
  return resolveRepository(getGitHubPat());
}

export async function getPublicContent() {
  const { owner, name, defaultBranch } = await publicRepository();
  return readPublicContent(owner, name, defaultBranch);
}
