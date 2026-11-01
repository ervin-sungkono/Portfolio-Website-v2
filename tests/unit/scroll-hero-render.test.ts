import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { ScrollHero } from '@/components/home/ScrollHero';

function renderHero(count: number) {
  const slides = Array.from({ length: count }, (_, index) => ({
    id: `project-${index}`,
    content: createElement('a', { href: `/project/${index}` }, `Project ${index}`),
  }));
  const props = { slides, children: 'Hero copy' };
  return renderToStaticMarkup(createElement(ScrollHero, props));
}

describe('ScrollHero server rendering', () => {
  test('shows a useful fallback when there are no slides', () => {
    const html = renderHero(0);
    expect(html).toContain('Featured projects will appear here.');
    expect(html).toContain('data-pinned="false"');
    expect(html).not.toContain('data-hero-slide');
  });

  test.each([1, 3, 4])('keeps only the first of %i slides available before hydration', (count) => {
    const html = renderHero(count);
    const slides = [...html.matchAll(/<div\b[^>]*data-hero-slide="(\d+)"[^>]*>/g)];
    expect(slides).toHaveLength(count);
    expect(slides[0][0]).toContain('aria-hidden="false"');
    expect(slides[0][0]).not.toMatch(/\sinert(?:=|\s|>)/);
    expect(slides[0][0]).toContain('opacity:1');
    for (const slide of slides.slice(1)) {
      expect(slide[0]).toContain('aria-hidden="true"');
      expect(slide[0]).toMatch(/\sinert(?:=|\s|>)/);
      expect(slide[0]).toContain('opacity:0');
    }
    expect(html).toContain('href="/project/0"');
    expect(html).toContain('data-pinned="false"');
  });
});
