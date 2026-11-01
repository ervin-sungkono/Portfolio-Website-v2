import { getPortfolio, getProjects, selectFeaturedProjects, getSiteContent } from '@/lib/content';
import { Experience } from '@/components/common/Experience';
import { HomeHero } from '@/components/home/HomeHero';
import { SelectedProjects } from '@/components/home/SelectedProjects';
import { PublishedSocialLinks } from '@/components/home/PublishedSocialLinks';
import { DesignPreview } from '@/components/home/DesignPreview';
import { pageMetadata } from '@/lib/metadata';
import styles from './style.module.css';

export async function generateMetadata() {
  const [content, { profile }] = await Promise.all([getSiteContent(), getPortfolio()]);
  const title = content.siteTitle.includes(profile.name)
    ? content.siteTitle
    : `${content.siteTitle} | ${profile.name}`;
  return pageMetadata({ title, description: content.introduction, path: '/' });
}

export default async function HomePage() {
  const [projects, content] = await Promise.all([getProjects(), getSiteContent()]);
  const featured = selectFeaturedProjects(projects);

  return (
    <div className={`container ${styles.home}`}>
      <HomeHero content={content} projects={featured.slice(0, 2)} />
      <SelectedProjects projects={featured} />
      <PublishedSocialLinks links={content.socialLinks} />
      <Experience />
      <DesignPreview />
    </div>
  );
}
