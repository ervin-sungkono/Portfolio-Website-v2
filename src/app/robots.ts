import type { MetadataRoute } from 'next';
import { site } from '@/lib/metadata';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/cms', '/api/auth'] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
