import type { MetadataRoute } from 'next';
import { getBlogPosts, getProjects } from '@/lib/content';
import { site } from '@/lib/metadata';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, posts] = await Promise.all([getProjects(), getBlogPosts()]);
  return [
    '/',
    '/about',
    '/project',
    '/blog',
    '/design',
    '/contact',
    ...projects.map((project) => `/project/${project.slug}`),
  ]
    .map((path) => ({ url: `${site.url}${path}` }))
    .concat(
      posts.map((post) => ({
        url: `${site.url}/blog/${post.slug}`,
        lastModified: post.publishedAt,
      })),
    );
}
