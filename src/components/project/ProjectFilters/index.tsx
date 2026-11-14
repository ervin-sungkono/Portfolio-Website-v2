import Link from 'next/link';
import { FloatingSearch } from './FloatingSearch';
import styles from './style.module.css';
import type { ProjectFiltersProps } from './type';

export function ProjectFilters({ query, category, categories, count }: ProjectFiltersProps) {
  function categoryUrl(value: string) {
    const search = new URLSearchParams();
    if (query) {
      search.set('q', query);
    }
    if (value) {
      search.set('category', value);
    }
    return `/project${search.size ? `?${search.toString()}` : ''}`;
  }
  return (
    <>
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
      </div>

      <FloatingSearch query={query} category={category} />

      <p className="results-count" aria-live="polite">
        {new Intl.NumberFormat('en').format(count)} {count === 1 ? 'project' : 'projects'}
        {query ? ` matching “${query}”` : ''}
      </p>
    </>
  );
}
