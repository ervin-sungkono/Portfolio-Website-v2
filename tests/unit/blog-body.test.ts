import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BlogBody } from '@/components/blog/BlogBody';

describe('BlogBody', () => {
  it('keeps section headings below the page title without skipping the editor heading level', () => {
    const html = renderToStaticMarkup(
      createElement(BlogBody, { body: '# Heading\n\n## Section\n\n### Subsection' }),
    );
    expect(html).not.toContain('<h1>');
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<h2>Section</h2>');
    expect(html).toContain('<h3>Subsection</h3>');
  });

  it('renders GFM tables, task lists, strikethrough, and code blocks', () => {
    const html = renderToStaticMarkup(
      createElement(BlogBody, {
        body: '| Item | Status |\n| --- | --- |\n| Draft | ~~old~~ |\n\n- [x] Published\n\n```ts\nconst ready = true;\n```',
      }),
    );

    expect(html).toContain('<table>');
    expect(html).toContain('<del>old</del>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<pre');
    expect(html).toContain('tabindex="0"');
  });

  it('does not render raw HTML or unsafe markdown URLs', () => {
    const html = renderToStaticMarkup(
      createElement(BlogBody, {
        body: '<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)\n\n<img src=x onerror=alert(1)>',
      }),
    );

    expect(html).not.toMatch(/<script(?:\s|>)/i);
    expect(html).not.toMatch(/<img(?:\s|>)/i);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toMatch(/onerror=/i);
  });
});
