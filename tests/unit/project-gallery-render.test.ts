import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { ProjectGallery } from '@/components/project/ProjectGallery';

describe('project gallery server rendering', () => {
  test('renders every screenshot in a usable no-JavaScript list before hydration', () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectGallery, {
        project: {
          name: 'Example Project',
          image: 'https://assets.example/cover.webp',
          gallery: ['https://assets.example/screen-2.webp', 'https://assets.example/screen-3.webp'],
        },
      }),
    );

    expect(markup.match(/<img\b/g)).toHaveLength(3);
    expect(markup).toContain('alt="Example Project application interface"');
    expect(markup).toContain('alt="Example Project screenshot 2"');
    expect(markup).toContain('alt="Example Project screenshot 3"');
    expect(markup).not.toContain('data-enhanced=""');
    expect(markup).not.toContain('aria-roledescription="carousel"');
  });

  test('keeps a cover-only project as a single image without carousel controls', () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectGallery, {
        project: {
          name: 'Example Project',
          image: 'https://assets.example/cover.webp',
          gallery: [],
        },
      }),
    );

    expect(markup.match(/<img\b/g)).toHaveLength(1);
    expect(markup).toContain('alt="Example Project application interface"');
    expect(markup).not.toContain('aria-roledescription="carousel"');
    expect(markup).not.toContain('Next screenshot for Example Project');
  });
});
