import Image from 'next/image';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ExternalLink } from '@/components/common/ExternalLink';
import { Reveal } from '@/components/common/Reveal';
import { imageSizes } from '@/lib/image-sizes';
import styles from './style.module.css';
import type { DesignCollectionProps } from './type';

export function DesignCollection({ designs, unavailable = false }: DesignCollectionProps) {
  const remainder = designs.length % 3;
  const closingStart = designs.length - (remainder === 1 ? 4 : remainder === 2 ? 2 : 0);
  return (
    <>
      <div className={styles.collectionBar}>
        <p className={styles.designCount} aria-live="polite">
          <span>{String(designs.length).padStart(2, '0')}</span>
          {designs.length === 1 ? 'design' : 'designs'}
        </p>
      </div>

      {designs.length ? (
        <div className={styles.designGrid}>
          {designs.map((design, index) => (
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
                      Dribbble Design
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
          <h2>{unavailable ? 'Designs Temporarily Unavailable.' : 'No Designs to Show.'}</h2>
          <p>
            {unavailable
              ? 'The design collection could not be loaded right now. Please check back soon.'
              : 'There are no selected designs to display right now.'}
          </p>
        </div>
      )}
    </>
  );
}
