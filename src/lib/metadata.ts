import type { Metadata } from 'next';
import { profile } from '@/content/profile';

// One public origin keeps previews, canonical links, and discovery files consistent.
export const site = {
  url: 'https://ervincs.com',
  name: profile.name,
  title: `${profile.name} | Frontend Software Engineer`,
  description: `${profile.name}, software engineer at Samsung R&D Institute Indonesia. Explore React and Next.js projects, frontend case studies, and interface design.`,
};

type PageMetadata = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
};

export function pageMetadata({
  title,
  description,
  path,
  image = '/images/preview-img.png',
  imageAlt = `${profile.name} software engineering portfolio`,
}: PageMetadata): Metadata {
  const fullTitle = path === '/' ? title : `${title} | ${site.name}`;
  return {
    title: path === '/' ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: site.name,
      type: 'website',
      images: [{ url: image, alt: imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
    },
  };
}
