import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon, ArrowUpRightIcon, GithubLogoIcon } from '@phosphor-icons/react/dist/ssr';
import { projects, findProject, projectStudies, relatedProjects } from '@/lib/content';
import { ExternalLink } from '@/components/external-link';
import { ProjectCard } from '@/components/project-card';
import styles from '@/components/engineering.module.css';

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = findProject(slug);
  if (!project) return { title: 'Project Not Found' };
  return {
    title: project.name,
    description: project.description,
    alternates: { canonical: `/project/${slug}` },
    openGraph: {
      title: `${project.name} | Ervin Sungkono`,
      description: project.description,
      url: `/project/${slug}`,
      type: 'website',
      images: [{ url: project.image, alt: `${project.name} application interface` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${project.name} | Ervin Sungkono`,
      description: project.description,
      images: [project.image],
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const project = findProject((await params).slug);
  if (!project) notFound();
  const study = projectStudies[project.slug];
  const related = relatedProjects(project);
  return (
    <div className="container snap-sections">
      <section className="page-heading project-detail-heading">
        <Link href="/project" className="text-link back-link">
          <ArrowLeftIcon size={17} aria-hidden="true" /> All Projects
        </Link>
        <p className="meta">{project.category}</p>
        <h1>{project.name}</h1>
        <p>{project.description}</p>
        {study && <p className="meta">Engineering Focus: {study.focus}</p>}
        <div className="hero-actions">
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
      <div className="detail-image">
        <Image
          src={project.image}
          alt={`${project.name} application interface`}
          width={1600}
          height={1000}
          sizes="(max-width: 1200px) 92vw, 1200px"
          preload
        />
      </div>
      <div className="detail-body section">
        <aside>
          <h2>Built With</h2>
          <div className="tags">
            {project.topics.map((topic) => (
              <span key={topic}>{topic}</span>
            ))}
          </div>
          <p className="detail-source-note">
            Project information and original screenshot from the public repository.
          </p>
          {study && (
            <nav className={styles.contents} aria-label="Project walkthrough sections">
              <a href="#overview">Overview</a>
              <a href="#engineering">Implementation & Tradeoffs</a>
              <a href="#next-step">Next Validation Step</a>
            </nav>
          )}
        </aside>
        <div>
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
              <section className="walkthrough" aria-labelledby="engineering">
                <h2 id="engineering">Implementation & Tradeoffs</h2>
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
              </section>
            </>
          )}
          <ExternalLink href={project.source} className="text-link">
            Explore the Implementation <ArrowUpRightIcon size={17} aria-hidden="true" />
          </ExternalLink>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section related-projects" aria-labelledby="related-heading">
          <div className="section-heading">
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
