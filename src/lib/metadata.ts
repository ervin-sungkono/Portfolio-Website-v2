import type { Metadata } from 'next';
import { getPortfolio } from '@/lib/content';

// One public origin keeps previews, canonical links, and discovery files consistent.
export const site = {
  url: 'https://ervincs.com',
};

type PageMetadata = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
};

export async function pageMetadata({
  title,
  description,
  path,
  image = '/images/preview-img.png',
  imageAlt,
}: PageMetadata): Promise<Metadata> {
  const { profile } = await getPortfolio();
  const fullTitle = path === '/' ? title : `${title} | ${profile.name}`;
  return {
    title: path === '/' ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: profile.name,
      type: 'website',
      images: [{ url: image, alt: imageAlt ?? `${profile.name} software engineering portfolio` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
    },
  };
}
