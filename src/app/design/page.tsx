import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { designs } from '@/lib/content';
import { profile } from '@/content/profile';
import { ExternalLink } from '@/components/external-link';
import { Reveal } from '@/components/motion/reveal';

export const metadata: Metadata = {
  title: 'Design',
  description:
    'Interface design explorations by Ervin Sungkono, from websites to mobile applications.',
  alternates: { canonical: '/design' },
};
export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const filtered = designs.filter((design) => !category || design.category === category);
  return (
    <div className="container">
      <section className="page-heading">
        <h1>
          Interfaces With
          <br />
          <span>Thought Behind Them.</span>
        </h1>
        <p>
          Visual explorations for websites and mobile applications, from layout and hierarchy to the
          smaller details.
        </p>
        <ExternalLink href={profile.dribbble} className="text-link">
          View Dribbble <ArrowUpRightIcon size={17} aria-hidden="true" />
        </ExternalLink>
      </section>
      <nav className="filters design-filters" aria-label="Design categories">
        {['All', 'Web', 'Mobile'].map((value) => (
          <Link
            key={value}
            href={value === 'All' ? '/design' : `/design?category=${value}`}
            aria-current={
              value === 'All'
                ? !category
                  ? 'page'
                  : undefined
                : category === value
                  ? 'page'
                  : undefined
            }
          >
            {value === 'All' ? 'All Designs' : `${value} Design`}
          </Link>
        ))}
      </nav>
      {filtered.length ? (
        <div className="design-grid">
          {filtered.map((design) => (
            <Reveal key={design.id}>
              <ExternalLink href={design.url} className="design-tile" data-cursor="project">
                <div className="design-image">
                  <Image
                    src={design.image}
                    alt={design.title}
                    width={1200}
                    height={900}
                    sizes="(max-width: 767px) 90vw, 46vw"
                    unoptimized={design.image.includes('.gif')}
                  />
                </div>
                <div className="design-caption">
                  <div>
                    <p className="meta">{design.category} Design</p>
                    <h2>{design.title.replace(' - ', ': ')}</h2>
                  </div>
                  <ArrowUpRightIcon size={20} aria-hidden="true" />
                </div>
              </ExternalLink>
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No Designs Found.</h2>
          <Link className="text-link" href="/design">
            View All Designs
          </Link>
        </div>
      )}
    </div>
  );
}
