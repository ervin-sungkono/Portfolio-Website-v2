import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { projectStudies, type Project } from '@/lib/content';
import { ExternalLink } from './external-link';
import styles from './project-card.module.css';
import { Reveal } from './motion/reveal';
import { PointerSurface } from './motion/pointer-surface';
import { ParallaxImage } from './motion/parallax-image';

export function ProjectCard({
  project,
  featured = false,
  headingLevel = 3,
  index,
}: {
  project: Project;
  featured?: boolean;
  headingLevel?: 2 | 3;
  index?: number;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const study = projectStudies[project.slug];

  return (
    <article className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <PointerSurface className={styles.pointerSurface}>
        <Link
          className={styles.imageLink}
          href={`/project/${project.slug}`}
          aria-label={`View ${project.name} project details`}
          data-cursor="project"
        >
          <div className={styles.imageFrame}>
            <span className={styles.frameLabel} aria-hidden="true">
              PROJECT /{' '}
              {index === undefined
                ? project.category.toUpperCase()
                : String(index).padStart(2, '0')}
            </span>
            <ParallaxImage>
              <Image
                src={project.image}
                alt={`${project.name} application screenshot`}
                width={1600}
                height={1000}
                sizes={
                  featured ? '(max-width: 1023px) 92vw, 58vw' : '(max-width: 767px) 92vw, 46vw'
                }
                className={styles.image}
              />
            </ParallaxImage>
          </div>
        </Link>
      </PointerSurface>
      <Reveal className={styles.content}>
        <div className={styles.heading}>
          <p className="editorial-label">{project.category}</p>
          <Heading>{project.name}</Heading>
        </div>
        <p className={styles.description}>{project.description}</p>
        <div className="tags">
          {project.topics.slice(0, 4).map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
        <div className={styles.links}>
          <Link href={`/project/${project.slug}`} className="text-link">
            {study ? 'Read Walkthrough' : 'Project Details'}
            <span className="sr-only"> for {project.name}</span>
            <ArrowUpRightIcon size={16} aria-hidden="true" />
          </Link>
          <ExternalLink href={project.source} className="text-link">
            Source <span className="sr-only"> for {project.name}</span>
            <ArrowUpRightIcon size={16} aria-hidden="true" />
          </ExternalLink>
        </div>
      </Reveal>
    </article>
  );
}
