import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon, ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { profile } from '@/content/profile';
import { featuredProjects, designs } from '@/lib/content';
import { ExternalLink } from '@/components/external-link';
import { ProjectCard } from '@/components/project-card';
import { Experience } from '@/components/experience';
import { EngineeringHighlights } from '@/components/engineering-highlights';
import { Reveal } from '@/components/motion/reveal';
import { PointerSurface } from '@/components/motion/pointer-surface';
import { ScrollHero } from '@/components/motion/scroll-hero';
import { pageMetadata, site } from '@/lib/metadata';
import styles from './home.module.css';
import { imageSizes } from '@/lib/image-sizes';

export const metadata = pageMetadata({
  title: site.title,
  description: site.description,
  path: '/',
});

export default function HomePage() {
  const [mainProject, secondaryProject, additionalProject] = featuredProjects;

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
              I’m {profile.name}, a software engineer at Samsung R&amp;D Institute Indonesia with a
              focus on frontend development and interface design.
            </p>
            <div className="hero-actions">
              <Link href="/project" className="button">
                Explore Projects <ArrowUpRightIcon size={20} aria-hidden="true" />
              </Link>
              <ExternalLink href={profile.cv} className="text-link">
                View CV <ArrowUpRightIcon size={17} aria-hidden="true" />
              </ExternalLink>
              <ExternalLink href={profile.github} className="text-link">
                GitHub <ArrowUpRightIcon size={17} aria-hidden="true" />
              </ExternalLink>
            </div>
          </Reveal>
        }
        visual={
          <PointerSurface>
            <Link
              href={`/project/${mainProject.slug}`}
              className={`hero-visual ${styles.heroVisual}`}
              data-cursor="project"
            >
              <div className="hero-image">
                <Image
                  src={mainProject.image}
                  alt="WeTrack Kanban board with tasks organised into sprints"
                  width={1600}
                  height={990}
                  sizes={imageSizes.hero}
                  preload
                />
              </div>
              <div className="hero-image-caption">
                <div>
                  <strong>WeTrack</strong>
                  <span>A workspace for getting things done.</span>
                </div>
                <ArrowUpRightIcon size={24} aria-hidden="true" />
              </div>
            </Link>
          </PointerSurface>
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
            <ProjectCard project={mainProject} featured index={1} sizes={imageSizes.homePrimary} />
          </div>
          <div className={styles.secondaryProject}>
            <ProjectCard project={secondaryProject} index={2} sizes={imageSizes.homeSecondary} />
          </div>
          <Link href="/engineering" className={styles.engineeringTeaser} data-cursor="link">
            <span className={styles.teaserKicker}>Architecture / Small pieces</span>
            <h3>How the pieces fit.</h3>
            <p>Architecture notes for this portfolio and selected project walkthroughs.</p>
            <span className={styles.teaserAction}>
              Explore engineering <ArrowUpRightIcon size={18} aria-hidden="true" />
            </span>
          </Link>
          <div className={styles.additionalProject}>
            <ProjectCard project={additionalProject} index={3} sizes={imageSizes.homeAdditional} />
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

      <EngineeringHighlights />

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
              <ExternalLink href={design.url} className="design-tile" data-cursor="project">
                <div className="design-image">
                  <Image
                    src={design.image}
                    alt={design.title}
                    width={1200}
                    height={900}
                    sizes={
                      index === 0 ? imageSizes.homeArtworkPrimary : imageSizes.homeArtworkSecondary
                    }
                  />
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
