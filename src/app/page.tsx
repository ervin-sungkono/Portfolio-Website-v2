import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRightIcon, ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
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

export const metadata = pageMetadata({
  title: site.title,
  description: site.description,
  path: '/',
});

export default function HomePage() {
  const mainProject = featuredProjects[0];
  return (
    <div className="container">
      <ScrollHero
        copy={
          <Reveal className="hero-copy">
            <p className="eyebrow">Software Engineering & Interface Design</p>
            <h1>
              Frontend Engineering.
              <br />
              <span>From UI to Integration.</span>
            </h1>
            <p className="hero-description">
              I’m {profile.name}, a software engineer at Samsung R&D Institute Indonesia with a
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
              className="hero-visual"
              data-cursor="project"
            >
              <div className="hero-image">
                <Image
                  src={mainProject.image}
                  alt="WeTrack Kanban board with tasks organised into sprints"
                  width={1600}
                  height={990}
                  sizes="(max-width: 1023px) 90vw, 48vw"
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
      <section className="selected section" id="projects">
        <Reveal className="section-heading">
          <h2>Selected Projects.</h2>
          <p>Interfaces, integrations, and the engineering behind them.</p>
        </Reveal>
        <div className="selected-grid">
          {featuredProjects.map((project, i) => (
            <ProjectCard key={project.id} project={project} featured={i === 0} />
          ))}
        </div>
        <Link href="/project" className="text-link section-link">
          Explore Projects <ArrowRightIcon size={18} aria-hidden="true" />
        </Link>
      </section>
      <EngineeringHighlights />
      <Experience />
      <section className="design-preview section">
        <Reveal className="section-heading">
          <h2>A Feel for the Interface.</h2>
          <p>
            Exploring visual hierarchy, interaction, and the details that make an interface feel
            considered.
          </p>
        </Reveal>
        <div className="design-preview-grid">
          {[designs[3], designs[1]].map((design) => (
            <Reveal key={design.id}>
              <ExternalLink href={design.url} className="design-tile" data-cursor="project">
                <div className="design-image">
                  <Image
                    src={design.image}
                    alt={design.title}
                    width={1200}
                    height={900}
                    sizes="(max-width: 767px) 90vw, 46vw"
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
        <Link href="/design" className="text-link section-link">
          Explore Designs <ArrowRightIcon size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
