import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${process.env.SITE_URL || 'https://ervin-sungkono.vercel.app'}/sitemap.xml`,
  };
}
