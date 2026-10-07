import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import type { Project } from '@/lib/content';
import styles from './project-card.module.css';

export function ProjectCard({
  project,
  featured = false,
  headingLevel = 3,
}: {
  project: Project;
  featured?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <Link
        className={styles.imageLink}
        href={`/project/${project.slug}`}
        aria-label={`Explore ${project.name}`}
      >
        <div className={styles.imageFrame}>
          <Image
            src={project.image}
            alt={`${project.name} application screenshot`}
            width={1600}
            height={1000}
            sizes={featured ? '(max-width: 767px) 92vw, 65vw' : '(max-width: 767px) 92vw, 46vw'}
            className={styles.image}
          />
        </div>
      </Link>
      <div className={styles.content}>
        <div className={styles.heading}>
          <div>
            <p className="meta">{project.category}</p>
            <Heading>
              <Link href={`/project/${project.slug}`}>{project.name}</Link>
            </Heading>
          </div>
          <Link
            href={`/project/${project.slug}`}
            className={styles.arrow}
            aria-label={`View ${project.name}`}
          >
            <ArrowUpRightIcon size={23} aria-hidden="true" />
          </Link>
        </div>
        <p className={styles.description}>{project.description}</p>
        <div className="tags">
          {project.topics.slice(0, 4).map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
