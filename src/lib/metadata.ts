import type { Metadata } from 'next';

// One public origin keeps previews, canonical links, and discovery files consistent.
export const publicName = 'Ervin Cahyadinata Sungkono';

export const site = {
  url: 'https://ervincs.com',
  name: publicName,
  title: `${publicName} | Frontend Software Engineer`,
  description: `${publicName}, software engineer at Samsung R&D Institute Indonesia. Explore React and Next.js projects, frontend case studies, and interface design.`,
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
  imageAlt = `${publicName} software engineering portfolio`,
}: PageMetadata): Metadata {
  const fullTitle = path === '/' ? title : `${title} | ${site.name}`;
  const normalizedDescription = description.trim().replace(/\s+/g, ' ');
  const summary =
    normalizedDescription.length > 240
      ? `${normalizedDescription.slice(0, 239).replace(/\s+\S*$/, '')}…`
      : normalizedDescription;
  return {
    title: path === '/' ? { absolute: title } : title,
    description: summary,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description: summary,
      url: path,
      siteName: site.name,
      type: 'website',
      images: [{ url: image, alt: imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: summary,
      images: [image],
    },
  };
}
