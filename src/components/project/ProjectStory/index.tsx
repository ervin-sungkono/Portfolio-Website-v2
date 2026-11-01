import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ExternalLink } from '@/components/common/ExternalLink';
import styles from './style.module.css';
import type { ProjectStoryProps } from './type';

export function ProjectStory({ project, study }: ProjectStoryProps) {
  return (
    <div className={`detail-body section ${styles.studyLayout}`}>
      <aside className={styles.sidebar}>
        <section className={styles.sideSection} aria-labelledby="built-with-heading">
          <p className="editorial-label">Project details</p>
          <h2 id="built-with-heading">Built With</h2>
          <div className="tags">
            {project.topics.map((topic) => (
              <span key={topic}>{topic}</span>
            ))}
          </div>
          <p className={styles.sourceNote}>
            Project information and original screenshot from the public repository.
          </p>
        </section>
        {study && (
          <nav className={styles.contents} aria-label="Project walkthrough sections">
            <a href="#overview">Overview</a>
            <a href="#engineering">Implementation &amp; Tradeoffs</a>
            <a href="#next-step">Next Validation Step</a>
          </nav>
        )}
      </aside>

      <article className={styles.projectStory}>
        <section className={styles.chapter} aria-labelledby="overview">
          <p className="editorial-label">Overview</p>
          <h2 id="overview">About the Project</h2>
          <p>{project.details || study?.context || project.description}</p>
          {study && (
            <>
              <h3>The Problem</h3>
              <p>{study.challenge}</p>
              <h3>What It Does</h3>
              <ul className="feature-list">
                {study.highlights.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </>
          )}
          {project.source && (
            <ExternalLink
              href={project.source}
              className={`text-link ${styles.implementationLink}`}
            >
              Explore the Implementation <ArrowUpRightIcon size={17} aria-hidden="true" />
            </ExternalLink>
          )}
        </section>

        {study && (
          <>
            <section className={`${styles.chapter} ${styles.technicalChapter}`}>
              <p className="editorial-label">Technical notes</p>
              <div className="walkthrough">
                <h2 id="engineering">Implementation &amp; Tradeoffs</h2>
                <p className="walkthrough-note">
                  Implementation summaries follow the public documentation. Tradeoffs are a
                  technical reading of those choices; next steps describe further validation.
                </p>
                <div className={styles.decisions}>
                  {study.decisions.map((decision) => (
                    <article key={decision.title} className={styles.decision}>
                      <h3>{decision.title}</h3>
                      <p>{decision.implementation}</p>
                      <p>
                        <strong>Tradeoff.</strong> {decision.tradeoff}
                      </p>
                    </article>
                  ))}
                </div>
                <div id="next-step" className={styles.nextStep}>
                  <h3>Next Validation Step</h3>
                  <p>{study.nextStep}</p>
                </div>
                <ExternalLink href={study.reference.href} className="text-link section-link">
                  {study.reference.label} <ArrowUpRightIcon size={17} aria-hidden="true" />
                </ExternalLink>
              </div>
            </section>
          </>
        )}
      </article>
    </div>
  );
}
