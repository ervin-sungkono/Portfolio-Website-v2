import type { MetadataRoute } from 'next';
import { projects } from '@/lib/content';
import { site } from '@/lib/metadata';
export default function sitemap(): MetadataRoute.Sitemap {
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
