import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { getPortfolio } from '@/lib/content';
import { ExternalLink } from '@/components/common/ExternalLink';
import { Reveal } from '@/components/common/Reveal';
import type { getSiteContent, Project } from '@/lib/content';
import { imageSizes } from '@/lib/image-sizes';
import { ScrollHero } from '../ScrollHero';
import styles from './style.module.css';

function HeroPreview({
  project,
  placeholder,
  preload,
}: {
  project: Project;
  placeholder: boolean;
  preload: boolean;
}) {
  return (
    <Link
      href={`/project/${project.slug}`}
      className={`hero-visual ${styles.heroVisual}`}
      data-cursor="project"
    >
      <div className={`hero-image ${styles.heroMedia}`}>
        {placeholder ? (
          <div className={styles.heroPlaceholder}>
            <span className={styles.placeholderWindow} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>Preview coming soon</span>
          </div>
        ) : (
          <div data-parallax="hero-image">
            <Image
              src={project.image}
              alt={
                project.slug === 'wetrack-app'
                  ? 'WeTrack Kanban board with tasks organised into sprints'
                  : `${project.name} application interface`
              }
              width={1600}
              height={990}
              sizes={imageSizes.hero}
              preload={preload}
            />
          </div>
        )}
      </div>
      <div className="hero-image-caption">
        <div>
          <strong>{project.name}</strong>
          <span>{placeholder ? 'Project preview coming soon.' : 'Selected project.'}</span>
        </div>
        <ArrowUpRightIcon size={24} aria-hidden="true" />
      </div>
    </Link>
  );
}

export async function HomeHero({
  content,
  projects,
}: {
  content: Awaited<ReturnType<typeof getSiteContent>>;
  projects: readonly Project[];
}) {
  const { profile } = await getPortfolio();
  const [headline, ...rest] = content.headline.split('\n');
  const slides = projects.map((project, index) => ({
    id: project.slug,
    content: <HeroPreview project={project} placeholder={index === 1} preload={index === 0} />,
  }));
  return (
    <ScrollHero slides={slides}>
      <Reveal className={`hero-copy ${styles.heroCopy}`}>
        <p className="eyebrow">Software Engineering &amp; Interface Design</p>
        <h1>
          {headline}
          {rest.length > 0 && (
            <>
              <br />
              <span>{rest.join(' ')}</span>
            </>
          )}
        </h1>
        <p className="hero-description">{content.introduction}</p>
        <div className="hero-actions">
          <Link href="/project" className="button">
            Explore Projects <ArrowUpRightIcon size={20} aria-hidden="true" />
          </Link>
          <ExternalLink href={profile.cv} className="text-link">
            View Resume <ArrowUpRightIcon size={17} aria-hidden="true" />
          </ExternalLink>
          <ExternalLink href={profile.github} className="text-link">
            GitHub <ArrowUpRightIcon size={17} aria-hidden="true" />
          </ExternalLink>
        </div>
      </Reveal>
    </ScrollHero>
  );
}
