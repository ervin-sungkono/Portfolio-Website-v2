import type { MetadataRoute } from 'next';
import { getProjects } from '@/lib/content';
import { site } from '@/lib/metadata';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getProjects();
  return [
    '/',
    '/about',
    '/project',
    '/design',
    '/contact',
    ...projects.map((project) => `/project/${project.slug}`),
  ].map((path) => ({ url: `${site.url}${path}` }));
}
