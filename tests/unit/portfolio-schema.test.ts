import { describe, expect, it } from 'vitest';
import { portfolioSchema } from '../../src/lib/cms/schemas';

const portfolio = {
  schemaVersion: 1,
  profile: {
    name: 'Example Owner',
    title: 'Engineer',
    linkedin: 'https://example.com/linkedin',
    github: 'https://example.com/github',
    dribbble: 'https://example.com/dribbble',
    instagram: 'https://example.com/instagram',
    cv: 'https://example.com/cv',
    intro: 'Example profile',
    experiences: [],
    education: { school: 'Example School', degree: 'Computing', years: '2020–2024' },
  },
  skills: [{ label: 'React', icon: 'react' }],
  designs: [],
  projectStudies: {},
  portfolioSource: 'https://example.com/source',
  portfolioSourceRef: 'example-ref',
};

describe('published portfolio content', () => {
  it('accepts remote profile data and an empty design collection', () => {
    expect(portfolioSchema.parse(portfolio).profile.name).toBe('Example Owner');
  });

  it('rejects unsupported versions and unsafe URLs', () => {
    expect(portfolioSchema.safeParse({ ...portfolio, schemaVersion: 2 }).success).toBe(false);
    expect(
      portfolioSchema.safeParse({
        ...portfolio,
        profile: { ...portfolio.profile, cv: 'javascript:alert(1)' },
      }).success,
    ).toBe(false);
  });
});
