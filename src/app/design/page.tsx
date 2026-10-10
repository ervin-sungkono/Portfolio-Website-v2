import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { designs } from '@/lib/content';
import { profile } from '@/content/profile';
import { ExternalLink } from '@/components/external-link';
import { Reveal } from '@/components/motion/reveal';
import { pageMetadata } from '@/lib/metadata';
import styles from './design.module.css';
import { imageSizes } from '@/lib/image-sizes';

export const metadata = pageMetadata({
  title: 'Web & Mobile Interface Design',
  description: `Browse web and mobile interface designs by ${profile.name}, including dashboards, healthcare websites, and application UI explorations.`,
  path: '/design',
});

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory = typeof category === 'string' ? category : '';
  const filtered = designs.filter(
    (design) => !activeCategory || design.category === activeCategory,
  );
  const categories = [...new Set(designs.map((design) => design.category))];
  const remainder = filtered.length % 3;
  const closingStart = filtered.length - (remainder === 1 ? 4 : remainder === 2 ? 2 : 0);

  return (
    <div className="container">
      <section className={`page-heading ${styles.designIntro}`}>
        <p className="editorial-label">Portfolio / Design</p>
        <h1>
          Interfaces With
          <br />
          <span>Thought Behind Them.</span>
        </h1>
        <p>
          Visual explorations for websites and mobile applications, from layout and hierarchy to the
          smaller details.
        </p>
        <ExternalLink href={profile.dribbble} className={`text-link ${styles.profileLink}`}>
          View Dribbble <ArrowUpRightIcon size={17} aria-hidden="true" />
        </ExternalLink>
      </section>

      <div className={styles.collectionBar}>
        <nav className="filters design-filters" aria-label="Design categories">
          <Link href="/design" aria-current={!activeCategory ? 'page' : undefined}>
            All Designs
          </Link>
          {categories.map((value) => (
            <Link
              key={value}
              href={`/design?category=${encodeURIComponent(value)}`}
              aria-current={activeCategory === value ? 'page' : undefined}
            >
              {value} Design
            </Link>
          ))}
        </nav>
        <p className={styles.designCount} aria-live="polite">
          <span>{String(filtered.length).padStart(2, '0')}</span>
          {filtered.length === 1 ? 'design' : 'designs'}
        </p>
      </div>

      {filtered.length ? (
        <div className={styles.designGrid}>
          {filtered.map((design, index) => (
            <Reveal key={design.id} className={styles.designReveal}>
              <ExternalLink href={design.url} className={styles.designTile} data-cursor="project">
                <div className={styles.artworkFrame}>
                  <div className={styles.artworkMat}>
                    <Image
                      src={design.image}
                      alt=""
                      fill
                      sizes={
                        index >= closingStart ? imageSizes.twoColumns : imageSizes.threeColumns
                      }
                      className={styles.artworkImage}
                      unoptimized={design.image.includes('.gif')}
                    />
                  </div>
                </div>
                <div className={styles.designCaption}>
                  <div>
                    <p className="editorial-label">
                      <span aria-hidden="true">{String(index + 1).padStart(2, '0')} / </span>
                      {design.category} Design
                    </p>
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
