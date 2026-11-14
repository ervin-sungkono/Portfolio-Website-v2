import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { Button } from '@/components/common/Button';

function renderButton(props: React.ComponentProps<typeof Button>) {
  return renderToStaticMarkup(createElement(Button, props));
}

describe('Button native semantics', () => {
  test('keeps action button attributes and does not add an arrow', () => {
    const markup = renderButton({
      kind: 'action',
      type: 'submit',
      disabled: true,
      children: 'Save',
    });

    expect(markup).toContain('<button');
    expect(markup).toContain('type="submit"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('class="button"');
    expect(markup).not.toContain('<svg');
  });

  test('keeps icon buttons compact without adding an arrow', () => {
    const markup = renderButton({
      kind: 'action',
      variant: 'icon',
      'aria-label': 'Close',
      children: '×',
    });

    expect(markup).toContain('class="icon-button"');
    expect(markup).toContain('aria-label="Close"');
    expect(markup).toContain('type="button"');
    expect(markup).not.toContain('<svg');
  });

  test('renders internal links with their variant and a decorative right arrow', () => {
    const markup = renderButton({
      kind: 'link',
      href: '/project',
      variant: 'outline',
      'aria-label': 'Browse projects',
      children: 'Projects',
    });

    expect(markup).toContain('<a');
    expect(markup).toContain('href="/project"');
    expect(markup).toContain('aria-label="Browse projects"');
    expect(markup).toContain('class="button button-outline"');
    expect(markup).toContain('<svg');
    expect(markup).toContain('aria-hidden="true"');
  });

  test('makes external links safe and allows suppressing the default arrow', () => {
    const defaultMarkup = renderButton({
      kind: 'external',
      href: 'https://example.com',
      rel: 'nofollow',
      children: 'Visit',
    });
    expect(defaultMarkup).toContain('target="_blank"');
    expect(defaultMarkup).toContain('rel="nofollow noopener noreferrer"');
    expect(defaultMarkup).toContain('<svg');

    const suppressedMarkup = renderButton({
      kind: 'external',
      href: 'https://example.com',
      showArrow: false,
      children: 'Visit',
    });

    expect(suppressedMarkup).not.toContain('<svg');
  });
});
