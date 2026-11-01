import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon, ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ExternalLink } from '@/components/common/ExternalLink';
import { ParallaxImage } from '@/components/common/ParallaxImage';
import { Reveal } from '@/components/common/Reveal';
import { getDesigns, type Design } from '@/lib/content';
import { imageSizes } from '@/lib/image-sizes';
import styles from './style.module.css';

export async function DesignPreview() {
  let designs: readonly Design[] = [];
  let unavailable = false;
  try {
    designs = await getDesigns();
  } catch {
    designs = [];
    unavailable = true;
  }
  const previews = designs.slice(0, 2);
  if (!previews.length && !unavailable) {
    return null;
  }

  return (
    <section
      className={`design-preview section ${styles.designSection}`}
      aria-labelledby="design-heading"
    >
      <Reveal className={`section-heading ${styles.sectionHeading}`}>
        <h2 id="design-heading">A Feel for the Interface.</h2>
        <p>
          {unavailable
            ? 'Selected design work is temporarily unavailable. Please check back soon.'
            : 'Exploring visual hierarchy, interaction, and the details that make an interface feel considered.'}
        </p>
      </Reveal>
      <div className={`design-preview-grid ${styles.designGallery}`}>
        {previews.map((design, index) => (
          <Reveal key={design.id}>
            <ExternalLink
              href={design.url}
              className={`design-tile ${index === 0 ? styles.parallaxArtwork : ''}`}
              data-cursor="project"
            >
              <div className="design-image">
                {index === 0 ? (
                  <ParallaxImage travel={1.5}>
                    <Image
                      src={design.image}
                      alt=""
                      width={1200}
                      height={900}
                      sizes={imageSizes.homeArtworkPrimary}
                    />
                  </ParallaxImage>
                ) : (
                  <Image
                    src={design.image}
                    alt=""
                    width={1200}
                    height={900}
                    sizes={imageSizes.homeArtworkSecondary}
                  />
                )}
              </div>
              <div className="design-caption">
                <h3>{design.title.replace(' - ', ': ')}</h3>
                <ArrowUpRightIcon size={19} aria-hidden="true" />
              </div>
            </ExternalLink>
          </Reveal>
        ))}
      </div>
      <Link href="/design" className={`text-link section-link ${styles.collectionLink}`}>
        Explore Designs <ArrowRightIcon size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}
