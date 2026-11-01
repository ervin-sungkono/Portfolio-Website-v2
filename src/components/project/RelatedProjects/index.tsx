import { ProjectCard } from '@/components/common/ProjectCard';
import styles from './style.module.css';
import type { RelatedProjectsProps } from './type';

export function RelatedProjects({ related }: RelatedProjectsProps) {
  if (related.length === 0) {
    return null;
  }

  return (
    <section
      className={`section related-projects ${styles.relatedSection}`}
      aria-labelledby="related-heading"
    >
      <div className="section-heading">
        <p className="editorial-label">Continue browsing</p>
        <h2 id="related-heading">Keep Exploring.</h2>
        <p>More work with related technologies and application patterns.</p>
      </div>
      <div className="project-grid">
        {related.map((candidate) => (
          <ProjectCard key={candidate.id} project={candidate} />
        ))}
      </div>
    </section>
  );
}
