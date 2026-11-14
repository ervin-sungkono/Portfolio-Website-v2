import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '@/lib/content';

vi.mock('@/lib/content', () => ({ getDesigns: async () => [] }));

import { SelectedProjects } from '@/components/home/SelectedProjects';

describe('selected project slots', () => {
  it.each([0, 1, 2, 3])('renders only the %i available projects', async (count) => {
    const projects: Project[] = Array.from({ length: count }, (_, index) => ({
      id: String(index),
      slug: `project-${index}`,
      name: `Project ${index}`,
      description: 'Project description',
      image: 'https://example.com/image.png',
      topics: [],
      category: 'Web',
      year: 2026,
      source: null,
      demo: null,
    }));
    const html = renderToStaticMarkup(await SelectedProjects({ projects }));
    expect(html).toContain(`data-project-count="${count}"`);
    expect(html.match(/class="project-card /g) ?? []).toHaveLength(count);
    expect(html).toContain('Visual explorations.');
  });
});
