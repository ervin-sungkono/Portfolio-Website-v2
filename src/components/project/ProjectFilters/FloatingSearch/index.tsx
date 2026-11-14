'use client';

import { useEffect, useRef } from 'react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr';
import styles from './style.module.css';
import type { FloatingSearchProps } from './type';

export function FloatingSearch({ query, category }: FloatingSearchProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let previous = window.scrollY;
    let frame = 0;
    function update() {
      frame = 0;
      const current = window.scrollY;
      if (current < 80 || current < previous - 6) {
        container.current?.removeAttribute('data-hidden');
        previous = current;
      } else if (current > previous + 6) {
        container.current?.setAttribute('data-hidden', 'true');
        previous = current;
      }
    }
    function onScroll() {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div ref={container} className={styles.floatingSearch}>
      <form action="/project" method="get" className={`search-form ${styles.search}`}>
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
  );
}
