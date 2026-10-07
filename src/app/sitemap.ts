import type { MetadataRoute } from 'next';
import { projects } from '@/lib/content';
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.SITE_URL || 'https://ervin-sungkono.vercel.app';
  return [
    '/',
    '/about',
    '/project',
    '/design',
    '/contact',
    ...projects.map((project) => `/project/${project.slug}`),
  ].map((path) => ({ url: `${origin}${path}` }));
}
