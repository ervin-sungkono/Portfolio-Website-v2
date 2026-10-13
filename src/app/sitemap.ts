import type { MetadataRoute } from 'next';
import { getPublishedContent } from '@/lib/content';
import { site } from '@/lib/metadata';

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { projects } = await getPublishedContent();
  return [
    '/',
    '/about',
    '/project',
    '/design',
    '/contact',
    '/engineering',
    ...projects.map((project) => `/project/${project.slug}`),
  ].map((path) => ({ url: `${site.url}${path}` }));
}
