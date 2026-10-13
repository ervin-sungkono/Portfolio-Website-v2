import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRightIcon, ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { getPublishedContent } from '@/lib/content';
import { ExternalLink } from '@/components/ExternalLink';
import { ProjectCard } from '@/components/ProjectCard';
import { Experience } from '@/components/Experience';
import { EngineeringHighlights } from '@/components/EngineeringHighlights';
import { Reveal } from '@/components/Reveal';
import { ParallaxImage } from '@/components/ParallaxImage';
import { ScrollHero } from '@/components/ScrollHero';
import { pageMetadata, site } from '@/lib/metadata';
import styles from './home.module.css';
import { imageSizes } from '@/lib/image-sizes';

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await getPublishedContent();
  return pageMetadata({
    title: site.title,
    description: profile.intro ? `${profile.name}. ${profile.intro}` : site.description,
    path: '/',
  });
}

export default async function HomePage() {
  const { projects, designs, profile, projectStudies } = await getPublishedContent();
  const featuredProjects = projects.slice(0, 3);
  const [mainProject, secondaryProject, additionalProject] = featuredProjects;
  const designPreviews = designs.length >= 4 ? [designs[3], designs[1]] : designs.slice(0, 2);
  const designTeaser = designs[0];

  return (
    <div className={`container ${styles.home}`}>
      <ScrollHero
        copy={
          <Reveal className={`hero-copy ${styles.heroCopy}`}>
            <p className="eyebrow">Software Engineering &amp; Interface Design</p>
            <h1>
              Frontend Engineering.
              <br />
              <span>From UI to Integration.</span>
            </h1>
            <p className="hero-description">
              {profile.title
                ? `I’m ${profile.name}, a ${profile.title.toLowerCase()} with a focus on frontend development and interface design.`
                : `I’m ${profile.name}. ${profile.intro}`}
            </p>
            <div className="hero-actions">
              <Link href="/project" className="button">
                Explore Projects <ArrowUpRightIcon size={20} aria-hidden="true" />
              </Link>
              {profile.cv && (
                <ExternalLink href={profile.cv} className="text-link">
                  View Resume <ArrowUpRightIcon size={17} aria-hidden="true" />
                </ExternalLink>
              )}
              {profile.github && (
                <ExternalLink href={profile.github} className="text-link">
                  GitHub <ArrowUpRightIcon size={17} aria-hidden="true" />
                </ExternalLink>
              )}
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
                        : `${mainProject.name} application screenshot`
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
                  <span>{mainProject.description}</span>
                </div>
                <ArrowUpRightIcon size={24} aria-hidden="true" />
              </div>
            </Link>
          ) : (
            <div className={`hero-visual ${styles.heroVisual}`}>
              <div className={`hero-image ${styles.heroMedia}`}>
                <p>No projects are published yet.</p>
              </div>
            </div>
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
          {!projects.length && <p className="empty-state">No projects are published yet.</p>}
          {mainProject && (
            <div className={styles.primaryProject}>
              <ProjectCard
                project={mainProject}
                study={projectStudies[mainProject.slug]}
                featured
                index={1}
                sizes={imageSizes.homePrimary}
                parallaxTravel={1.5}
              />
            </div>
          )}
          {secondaryProject && (
            <div className={styles.secondaryProject}>
              <ProjectCard
                project={secondaryProject}
                study={projectStudies[secondaryProject.slug]}
                index={2}
                sizes={imageSizes.homeSecondary}
                parallaxTravel={1}
              />
            </div>
          )}
          <Link href="/engineering" className={styles.engineeringTeaser} data-cursor="link">
            <span className={styles.teaserKicker}>Architecture / Small pieces</span>
            <h3>How the pieces fit.</h3>
            <p>Architecture notes for this portfolio and selected project walkthroughs.</p>
            <span className={styles.teaserAction}>
              Explore engineering <ArrowUpRightIcon size={18} aria-hidden="true" />
            </span>
          </Link>
          {additionalProject && (
            <div className={styles.additionalProject}>
              <ProjectCard
                project={additionalProject}
                study={projectStudies[additionalProject.slug]}
                index={3}
                sizes={imageSizes.homeAdditional}
                parallaxTravel={1}
              />
            </div>
          )}
          <Link href="/design" className={styles.designTeaser} data-cursor="link">
            <span className={styles.teaserKicker}>Interface studies</span>
            <div className={styles.teaserImage}>
              {designTeaser && (
                <Image
                  src={designTeaser.image}
                  alt={designTeaser.title}
                  width={1200}
                  height={900}
                  sizes={imageSizes.homeTeaser}
                />
              )}
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

      <EngineeringHighlights projects={projects} projectStudies={projectStudies} />

      <Experience profile={profile} />

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
          {designPreviews.map((design, index) => (
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
                      sizes={imageSizes.homeArtworkSecondary}
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
