import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ExternalLink } from '@/components/common/ExternalLink';
import { Reveal } from '@/components/common/Reveal';
import { imageSizes } from '@/lib/image-sizes';
import styles from './style.module.css';
import type { DesignCollectionProps } from './type';

export function DesignCollection({ activeCategory, categories, filtered }: DesignCollectionProps) {
  const remainder = filtered.length % 3;
  const closingStart = filtered.length - (remainder === 1 ? 4 : remainder === 2 ? 2 : 0);
  return (
    <>
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
    </>
  );
}
