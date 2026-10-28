export type CacheTarget = 'project' | 'post' | 'site' | 'taxonomy' | 'all';

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
  if (target === 'post') {
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error('A valid post slug is required for revalidation.');
    }
    return {
      tags: ['posts', `post:${slug}`],
      paths: ['/blog', `/blog/${slug}`, '/sitemap.xml'],
    };
  }
  if (target === 'site') {
    return { tags: ['site'], paths: ['/'] };
  }
  return {
    tags: target === 'all' ? ['site', 'taxonomy', 'projects', 'posts'] : ['taxonomy', 'projects'],
    paths:
      target === 'all'
        ? ['/', '/project', '/sitemap.xml', '/project/[slug]', '/blog', '/blog/[slug]']
        : ['/', '/project', '/sitemap.xml', '/project/[slug]'],
  };
}
