import Link from 'next/link';
import { MagnifyingGlassIcon, ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import { featuredProjects, projects, filterProjects } from '@/lib/content';
import { ProjectCard } from '@/components/project-card';
import { pageMetadata } from '@/lib/metadata';
import { profile } from '@/content/profile';
import styles from './projects.module.css';

export const metadata = pageMetadata({
  title: 'Software Engineering Projects',
  description: `Explore ${profile.name}’s React and Next.js projects, including WeTrack, a streaming chat interface, and an API-driven catalogue, with case studies and source code.`,
  path: '/project',
});

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q : '';
  const category = typeof params.category === 'string' ? params.category : '';
  const filtered = filterProjects(query, category);
  const categories = [...new Set(projects.map((project) => project.category))];
  const isUnfiltered = !query && !category;

  function categoryUrl(value: string) {
    const search = new URLSearchParams();
    if (query) search.set('q', query);
    if (value) search.set('category', value);
    return `/project${search.size ? `?${search.toString()}` : ''}`;
  }

  function projectIndex(slug: string) {
    return projects.findIndex((project) => project.slug === slug) + 1;
  }

  const archive = isUnfiltered
    ? filtered.filter((project) => !featuredProjects.includes(project))
    : filtered;

  return (
    <div className="container">
      <section className={`page-heading ${styles.collectionIntro}`}>
        <p className="editorial-label">Portfolio / Projects</p>
        <h1>
          Projects Built
          <br />
          <span>to Explore Ideas.</span>
        </h1>
        <p>
          A collection of web applications, mobile projects, and development experiments. Explore
          the interface and the source behind it.
        </p>
      </section>

      <div className={`collection-toolbar ${styles.toolbar}`}>
        <nav className="filters" aria-label="Project categories">
          <Link href={categoryUrl('')} aria-current={!category ? 'page' : undefined}>
            All Projects
          </Link>
          {categories.map((value) => (
            <Link
              key={value}
              href={categoryUrl(value)}
              aria-current={category === value ? 'page' : undefined}
            >
              {value}
            </Link>
          ))}
        </nav>
        <form action="/project" method="get" className="search-form">
          <label htmlFor="project-search" className="sr-only">
            Search projects and technologies
          </label>
          <input
            id="project-search"
            name="q"
            type="search"
            placeholder="Search projects…"
            defaultValue={query}
            autoComplete="off"
          />
          {category && <input type="hidden" name="category" value={category} />}
          <button type="submit" aria-label="Search projects">
            <MagnifyingGlassIcon size={20} aria-hidden="true" />
          </button>
        </form>
      </div>

      <p className="results-count" aria-live="polite">
        {new Intl.NumberFormat('en').format(filtered.length)}{' '}
        {filtered.length === 1 ? 'project' : 'projects'}
        {query ? ` matching “${query}”` : ''}
      </p>

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
                headingLevel={3}
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
                headingLevel={3}
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
    </div>
  );
}
