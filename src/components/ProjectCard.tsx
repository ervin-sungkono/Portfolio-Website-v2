import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { projectStudies, type Project } from '@/lib/content';
import { ExternalLink } from './ExternalLink';
import styles from './project-card.module.css';
import { Reveal } from './motion/Reveal';
import { PointerSurface } from './motion/PointerSurface';
import { ParallaxImage } from './motion/ParallaxImage';
import { imageSizes } from '@/lib/image-sizes';

export function ProjectCard({
  project,
  featured = false,
  headingLevel = 3,
  index,
  sizes = imageSizes.twoColumns,
  parallaxTravel,
}: {
  project: Project;
  featured?: boolean;
  headingLevel?: 2 | 3;
  index?: number;
  sizes?: string;
  parallaxTravel?: 1 | 1.25 | 1.5 | 2;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const study = projectStudies[project.slug];
  const Surface = parallaxTravel === undefined ? PointerSurface : 'div';

  return (
    <article className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <Surface className={styles.pointerSurface}>
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
            <ParallaxImage travel={parallaxTravel}>
              <Image
                src={project.image}
                alt={`${project.name} application screenshot`}
                width={1600}
                height={1000}
                sizes={sizes}
                className={styles.image}
              />
            </ParallaxImage>
          </div>
        </Link>
      </Surface>
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
