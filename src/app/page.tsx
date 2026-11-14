import {
  getPortfolio,
  getProjects,
  getSiteContent,
  selectFeaturedProjects,
  selectHeroProjects,
} from '@/lib/content';
import { Experience } from '@/components/common/Experience';
import { HomeHero } from '@/components/home/HomeHero';
import { SelectedProjects } from '@/components/home/SelectedProjects';
import { PublishedSocialLinks } from '@/components/home/PublishedSocialLinks';
import { DesignPreview } from '@/components/home/DesignPreview';
import { Button } from '@/components/common/Button';
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
  const [projects, content, portfolio] = await Promise.all([
    getProjects(),
    getSiteContent(),
    getPortfolio(),
  ]);
  const featured = selectFeaturedProjects(projects);
  const heroProjects = selectHeroProjects(projects, content.heroProjectSlugs);

  return (
    <div className={`container ${styles.home}`}>
      <HomeHero content={content} projects={heroProjects} />
      <SelectedProjects projects={featured} />
      <PublishedSocialLinks links={content.socialLinks} />
      <Experience />
      <DesignPreview />
      <section
        className={`section ${styles.engineering}`}
        id="engineering"
        aria-labelledby="engineering-heading"
      >
        <div>
          <p className="eyebrow">Behind the portfolio</p>
          <h2 id="engineering-heading">Built with clear boundaries.</h2>
          <p>
            Next.js and TypeScript bring the portfolio together: server-rendered content, focused
            browser interactions, and a GitHub-backed CMS for managing the work.
          </p>
          <Button kind="external" href={portfolio.portfolioSource} variant="text">
            Explore the source
          </Button>
        </div>
      </section>
    </div>
  );
}
