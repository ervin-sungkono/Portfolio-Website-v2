import { getPortfolio } from '@/lib/content';
import { Experience } from '@/components/common/Experience';
import { AboutIntro } from '@/components/about/AboutIntro';
import { Skills } from '@/components/about/Skills';
import { Background } from '@/components/about/Background';
import { pageMetadata, site } from '@/lib/metadata';

export async function generateMetadata() {
  const { profile } = await getPortfolio();
  return pageMetadata({
    title: 'About — Software Engineering Experience',
    description: `Meet ${profile.name}, a software engineer at Samsung R&D Institute Indonesia with experience in frontend development, React, Next.js, and UI design.`,
    path: '/about',
  });
}

export default async function AboutPage() {
  const { profile } = await getPortfolio();
  const profileSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${site.url}/about#profile`,
    url: `${site.url}/about`,
    mainEntity: {
      '@type': 'Person',
      '@id': `${site.url}/#person`,
      name: profile.name,
      url: site.url,
      jobTitle: profile.title,
      sameAs: [profile.linkedin, profile.github, profile.dribbble],
    },
  };
  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileSchema).replace(/</g, '\\u003c') }}
      />
      <AboutIntro />
      <Experience detailed />
      <Skills />
      <Background />
    </div>
  );
}
