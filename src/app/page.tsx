import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon, ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { profile } from '@/content/profile';
import { getProjects, selectFeaturedProjects, getSiteContent, designs } from '@/lib/content';
import { ExternalLink } from '@/components/common/ExternalLink';
import { ProjectCard } from '@/components/common/ProjectCard';
import { Experience } from '@/components/Experience';
import { Reveal } from '@/components/common/Reveal';
import { ParallaxImage } from '@/components/common/ParallaxImage';
import { ScrollHero } from '@/components/ScrollHero';
import { pageMetadata } from '@/lib/metadata';
import styles from './home.module.css';
import { imageSizes } from '@/lib/image-sizes';

export async function generateMetadata() {
  const content = await getSiteContent();
  const title = content.siteTitle.includes(profile.name)
    ? content.siteTitle
    : `${content.siteTitle} | ${profile.name}`;
  return pageMetadata({ title, description: content.introduction, path: '/' });
}

export default async function HomePage() {
  const [projects, content] = await Promise.all([getProjects(), getSiteContent()]);
  const [mainProject, secondaryProject, additionalProject] = selectFeaturedProjects(projects);
  const [headline, ...rest] = content.headline.split('\n');

  return (
    <div className={`container ${styles.home}`}>
      <ScrollHero
        copy={
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
        }
        visual={
          mainProject ? (
            <Link
              href={`/project/${mainProject.slug}`}
              className={`hero-visual ${styles.heroVisual}`}
              data-cursor="project"
            >
              <div className={`hero-image ${styles.heroMedia}`}>
                <div data-parallax="hero-image">
                  <Image
                    src={mainProject.image}
                    alt={
                      mainProject.slug === 'wetrack-app'
                        ? 'WeTrack Kanban board with tasks organised into sprints'
                        : `${mainProject.name} application interface`
                    }
                    width={1600}
                    height={990}
                    sizes={imageSizes.hero}
                    preload
                  />
                </div>
              </div>
              <div className="hero-image-caption">
                <div>
                  <strong>{mainProject.name}</strong>
                  <span>Selected project.</span>
                </div>
                <ArrowUpRightIcon size={24} aria-hidden="true" />
              </div>
            </Link>
          ) : (
            <p>Featured projects will appear here.</p>
          )
        }
        nextVisual={
          secondaryProject ? (
            <Link
              href={`/project/${secondaryProject.slug}`}
              className={`hero-visual ${styles.heroVisual}`}
              data-cursor="project"
            >
              <div className={`hero-image ${styles.heroMedia}`}>
                {/* Replace this placeholder with the supplied project image. */}
                <div className={styles.heroPlaceholder}>
                  <span className={styles.placeholderWindow} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>Preview coming soon</span>
                </div>
              </div>
              <div className="hero-image-caption">
                <div>
                  <strong>{secondaryProject.name}</strong>
                  <span>Project preview coming soon.</span>
                </div>
                <ArrowUpRightIcon size={24} aria-hidden="true" />
              </div>
            </Link>
          ) : null
        }
      />

      <section
        className={`selected section ${styles.selected}`}
        id="projects"
        aria-labelledby="selected-heading"
      >
        <Reveal className={`section-heading ${styles.sectionHeading}`}>
          <p className={`eyebrow ${styles.sectionIndex}`}>01 / Selected work</p>
          <h2 id="selected-heading">Selected Projects.</h2>
          <p>Interfaces, integrations, and the engineering behind them.</p>
        </Reveal>

        <div className={styles.bentoGrid}>
          <div className={styles.primaryProject}>
            {mainProject && (
              <ProjectCard
                project={mainProject}
                featured
                index={1}
                sizes={imageSizes.homePrimary}
                parallaxTravel={1.5}
              />
            )}
          </div>
          <div className={styles.secondaryProject}>
            {secondaryProject && (
              <ProjectCard
                project={secondaryProject}
                index={2}
                sizes={imageSizes.homeSecondary}
                parallaxTravel={1}
              />
            )}
          </div>
          <div className={styles.additionalProject}>
            {additionalProject && (
              <ProjectCard
                project={additionalProject}
                index={3}
                sizes={imageSizes.homeAdditional}
                parallaxTravel={1}
              />
            )}
          </div>
          <Link href="/design" className={styles.designTeaser} data-cursor="link">
            <span className={styles.teaserKicker}>Interface studies</span>
            <div className={styles.teaserImage}>
              <Image
                src={designs[0].image}
                alt={designs[0].title}
                width={1200}
                height={900}
                sizes={imageSizes.homeTeaser}
              />
            </div>
            <h3>Visual explorations.</h3>
            <p>A few web and mobile studies from the full design archive.</p>
            <span className={styles.teaserAction}>
              Explore designs <ArrowUpRightIcon size={18} aria-hidden="true" />
            </span>
          </Link>
        </div>

        <Link href="/project" className={`text-link section-link ${styles.collectionLink}`}>
          Explore Projects <ArrowRightIcon size={18} aria-hidden="true" />
        </Link>
      </section>

      {content.socialLinks.length > 0 && (
        <nav className="hero-actions" aria-label="Published social links">
          {content.socialLinks.map(({ label, url }) => (
            <ExternalLink key={label} href={url} className="text-link">
              {label}
            </ExternalLink>
          ))}
        </nav>
      )}

      <Experience />

      <section
        className={`design-preview section ${styles.designSection}`}
        aria-labelledby="design-heading"
      >
        <Reveal className={`section-heading ${styles.sectionHeading}`}>
          <p className={`eyebrow ${styles.sectionIndex}`}>04 / Design</p>
          <h2 id="design-heading">A Feel for the Interface.</h2>
          <p>
            Exploring visual hierarchy, interaction, and the details that make an interface feel
            considered.
          </p>
        </Reveal>
        <div className={`design-preview-grid ${styles.designGallery}`}>
          {[designs[3], designs[1]].map((design, index) => (
            <Reveal key={design.id}>
              <ExternalLink
                href={design.url}
                className={`design-tile ${index === 0 ? styles.parallaxArtwork : ''}`}
                data-cursor="project"
              >
                <div className="design-image">
                  {index === 0 ? (
                    <ParallaxImage travel={1.5}>
                      <Image
                        src={design.image}
                        alt={design.title}
                        width={1200}
                        height={900}
                        sizes={imageSizes.homeArtworkPrimary}
                      />
                    </ParallaxImage>
                  ) : (
                    <Image
                      src={design.image}
                      alt={design.title}
                      width={1200}
                      height={900}
                      sizes={
                        index === 0
                          ? imageSizes.homeArtworkPrimary
                          : imageSizes.homeArtworkSecondary
                      }
                    />
                  )}
                </div>
                <div className="design-caption">
                  <h3>{design.title.replace(' - ', ': ')}</h3>
                  <ArrowUpRightIcon size={19} aria-hidden="true" />
                </div>
              </ExternalLink>
            </Reveal>
          ))}
        </div>
        <Link href="/design" className={`text-link section-link ${styles.collectionLink}`}>
          Explore Designs <ArrowRightIcon size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
