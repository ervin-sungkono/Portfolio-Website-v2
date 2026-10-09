import Link from 'next/link';
import { MagnifyingGlassIcon, ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import { projects, filterProjects } from '@/lib/content';
import { ProjectCard } from '@/components/project-card';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata({
  title: 'Software Engineering Projects',
  description:
    'Explore Ervin Sungkono’s React and Next.js projects, including WeTrack, a streaming chat interface, and an API-driven catalogue, with case studies and source code.',
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
  function categoryUrl(value: string) {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (value) p.set('category', value);
    return `/project${p.size ? '?' + p.toString() : ''}`;
  }
  return (
    <div className="container">
      <section className="page-heading">
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
      <div className="collection-toolbar">
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
      <p className="results-count">
        {new Intl.NumberFormat('en').format(filtered.length)}{' '}
        {filtered.length === 1 ? 'project' : 'projects'}
        {query ? ` matching “${query}”` : ''}
      </p>
      {filtered.length ? (
        <div className="project-grid">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} headingLevel={2} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No Projects Found.</h2>
          <p>Try another search or browse the full collection.</p>
          <Link href="/project" className="text-link">
            Clear Filters <ArrowRightIcon size={17} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
