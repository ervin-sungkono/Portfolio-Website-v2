import type { MetadataRoute } from 'next';
import { getBlogPosts, getProjects } from '@/lib/content';
import { site } from '@/lib/metadata';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, posts] = await Promise.all([getProjects(), getBlogPosts()]);
  return [
    '/',
    '/about',
    '/project',
    '/design',
    '/contact',
    '/blog',
    ...projects.map((project) => `/project/${project.slug}`),
    ...posts.map((post) => `/blog/${post.slug}`),
  ].map((path) => ({ url: `${site.url}${path}` }));
}
