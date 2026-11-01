export type CacheTarget = 'project' | 'site' | 'taxonomy' | 'designs' | 'all';

export function contentInvalidation(target: CacheTarget, slug?: string) {
  if (target === 'project') {
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error('A valid project slug is required for revalidation.');
    }
    return {
      tags: ['projects', `project:${slug}`],
      paths: ['/', '/project', `/project/${slug}`, '/sitemap.xml'],
    };
  }
  if (target === 'site') {
    return { tags: ['site'], paths: ['/'] };
  }
  if (target === 'designs') {
    return { tags: ['portfolio', 'designs'], paths: ['/', '/design'] };
  }
  return {
    tags:
      target === 'all'
        ? ['site', 'taxonomy', 'projects', 'portfolio', 'designs', 'content-source']
        : ['taxonomy', 'projects'],
    paths:
      target === 'all'
        ? ['/', '/about', '/contact', '/design', '/project', '/sitemap.xml', '/project/[slug]']
        : ['/', '/project', '/sitemap.xml', '/project/[slug]'],
  };
}

// A cache error must never turn an accepted Git commit into a failed publication.
export async function publishAndRevalidate<T>(
  write: () => Promise<T>,
  invalidate: () => void | Promise<void>,
) {
  const result = await write();
  try {
    await invalidate();
    return { ...result, cache: 'refreshed' as const };
  } catch {
    return { ...result, cache: 'pending' as const };
  }
}
