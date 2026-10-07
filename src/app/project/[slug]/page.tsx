import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon, ArrowUpRightIcon, GithubLogoIcon } from '@phosphor-icons/react/dist/ssr';
import { projects, findProject, projectNotes } from '@/lib/content';
import { ExternalLink } from '@/components/external-link';

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = findProject((await params).slug);
  return {
    title: project?.name || 'Project Not Found',
    description: project?.description,
    alternates: { canonical: `/project/${(await params).slug}` },
  };
}

export default async function ProjectPage({ params }: Props) {
  const project = findProject((await params).slug);
  if (!project) notFound();
  const notes = projectNotes[project.slug];
  return (
    <div className="container">
      <section className="page-heading project-detail-heading">
        <Link href="/project" className="text-link back-link">
          <ArrowLeftIcon size={17} aria-hidden="true" /> All Projects
        </Link>
        <p className="meta">{project.category}</p>
        <h1>{project.name}</h1>
        <p>{project.description}</p>
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
        </aside>
        <div>
          <h2>About the Project</h2>
          <p>{notes?.context || project.description}</p>
          {notes && (
            <>
              <h3>What It Does</h3>
              <ul className="feature-list">
                {notes.highlights.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <h3>Engineering Notes</h3>
              <p>{notes.engineering}</p>
            </>
          )}
          <ExternalLink href={project.source} className="text-link">
            Explore the Implementation <ArrowUpRightIcon size={17} aria-hidden="true" />
          </ExternalLink>
        </div>
      </div>
    </div>
  );
}
