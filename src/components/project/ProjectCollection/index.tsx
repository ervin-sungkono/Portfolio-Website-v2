import Link from 'next/link';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ProjectCard } from '@/components/common/ProjectCard';
import { imageSizes } from '@/lib/image-sizes';
import styles from './style.module.css';
import type { ProjectCollectionProps } from './type';

export function ProjectCollection({
  projects,
  featuredProjects,
  filtered,
  isUnfiltered,
}: ProjectCollectionProps) {
  function projectIndex(slug: string) {
    return projects.findIndex((project) => project.slug === slug) + 1;
  }
  const archive = isUnfiltered
    ? filtered.filter((project) => !featuredProjects.includes(project))
    : filtered;
  return (
    <>
      {isUnfiltered && featuredProjects.length > 0 && (
        <section className={styles.featuredSection} aria-labelledby="featured-projects-heading">
          <div className={styles.sectionHeading}>
            <p className="editorial-label">Selected work</p>
            <h2 id="featured-projects-heading">Featured projects</h2>
          </div>
          <div className={styles.featuredGrid}>
            {featuredProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={projectIndex(project.slug)}
                featured={index === 0}
                sizes={index === 0 ? imageSizes.featuredCollection : imageSizes.threeColumns}
              />
            ))}
          </div>
        </section>
      )}

      {archive.length ? (
        <section className={styles.archiveSection} aria-labelledby="project-archive-heading">
          {isUnfiltered && (
            <div className={styles.sectionHeading}>
              <p className="editorial-label">The collection</p>
              <h2 id="project-archive-heading">More projects</h2>
            </div>
          )}
          {!isUnfiltered && (
            <h2 className="sr-only" id="project-archive-heading">
              Search results
            </h2>
          )}
          <div className="project-grid">
            {archive.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={projectIndex(project.slug)}
                sizes={imageSizes.threeColumns}
              />
            ))}
          </div>
        </section>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No Projects Found.</h2>
          <p>Try another search or browse the full collection.</p>
          <Link href="/project" className="text-link">
            Clear Filters <ArrowRightIcon size={17} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </>
  );
}
