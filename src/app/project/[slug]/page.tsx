import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon, ArrowUpRightIcon, GithubLogoIcon } from '@phosphor-icons/react/dist/ssr';
import { projects, findProject, projectStudies, relatedProjects } from '@/lib/content';
import { ExternalLink } from '@/components/external-link';
import { ProjectCard } from '@/components/project-card';
import engineeringStyles from '@/components/engineering.module.css';
import { pageMetadata } from '@/lib/metadata';
import styles from './project-detail.module.css';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = findProject(slug);
  if (!project) return { title: 'Project Not Found' };
  return pageMetadata({
    title: project.name,
    description: project.description,
    path: `/project/${slug}`,
    image: project.image,
    imageAlt: `${project.name} application interface`,
  });
}

export default async function ProjectPage({ params }: Props) {
  const project = findProject((await params).slug);
  if (!project) notFound();
  const study = projectStudies[project.slug];
  const related = relatedProjects(project);

  return (
    <div className={`container ${styles.projectPage}`}>
      <section className={`page-heading project-detail-heading ${styles.projectHeader}`}>
        <Link href="/project" className={`text-link back-link ${styles.backLink}`}>
          <ArrowLeftIcon size={17} aria-hidden="true" /> All Projects
        </Link>
        <p className="editorial-label">{project.category}</p>
        <h1>{project.name}</h1>
        <p className={styles.projectDescription}>{project.description}</p>
        {study && <p className={`meta ${styles.focus}`}>Engineering Focus: {study.focus}</p>}
        <div className={`hero-actions ${styles.actions}`}>
          {project.demo && (
            <ExternalLink href={project.demo} className="button">
              Open Project <ArrowUpRightIcon size={18} aria-hidden="true" />
            </ExternalLink>
          )}
          <ExternalLink href={project.source} className="button button-outline">
            <GithubLogoIcon size={19} aria-hidden="true" /> View Source
          </ExternalLink>
        </div>
      </section>

      <figure className={styles.mediaFrame}>
        <div className={styles.mediaMat}>
          <Image
            src={project.image}
            alt={`${project.name} application interface`}
            width={1600}
            height={1000}
            sizes="(max-width: 1200px) 92vw, 1200px"
            preload
            className={styles.mediaImage}
          />
        </div>
      </figure>

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
            <nav className={engineeringStyles.contents} aria-label="Project walkthrough sections">
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
            <p>{study?.context || project.description}</p>
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
            <ExternalLink
              href={project.source}
              className={`text-link ${styles.implementationLink}`}
            >
              Explore the Implementation <ArrowUpRightIcon size={17} aria-hidden="true" />
            </ExternalLink>
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
                  <div className={engineeringStyles.decisions}>
                    {study.decisions.map((decision) => (
                      <article key={decision.title} className={engineeringStyles.decision}>
                        <h3>{decision.title}</h3>
                        <p>{decision.implementation}</p>
                        <p>
                          <strong>Tradeoff.</strong> {decision.tradeoff}
                        </p>
                      </article>
                    ))}
                  </div>
                  <div id="next-step" className={engineeringStyles.nextStep}>
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

      {related.length > 0 && (
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
      )}
    </div>
  );
}
