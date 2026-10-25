export type CacheTarget = 'project' | 'site' | 'taxonomy' | 'all';

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
  return {
    tags: target === 'all' ? ['site', 'taxonomy', 'projects'] : ['taxonomy', 'projects'],
    paths: ['/', '/project', '/sitemap.xml', '/project/[slug]'],
  };
}
