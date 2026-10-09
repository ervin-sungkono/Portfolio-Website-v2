import type { Metadata } from 'next';

// One public origin keeps previews, canonical links, and discovery files consistent.
export const site = {
  url: 'https://ervincs.com',
  name: 'Ervin Sungkono',
  title: 'Ervin Sungkono | Frontend Software Engineer',
  description:
    'Ervin Sungkono, software engineer at Samsung R&D Institute Indonesia. Explore React and Next.js projects, frontend case studies, and interface design.',
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
  imageAlt = 'Ervin Sungkono software engineering portfolio',
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
