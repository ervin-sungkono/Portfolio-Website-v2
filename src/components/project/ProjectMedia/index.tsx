import Image from 'next/image';
import { imageSizes } from '@/lib/image-sizes';
import styles from './style.module.css';
import type { ProjectMediaProps } from './type';

export function ProjectMedia({ project }: ProjectMediaProps) {
  return (
    <>
      <figure className={styles.mediaFrame}>
        <div className={styles.mediaMat}>
          <Image
            src={project.image}
            alt={`${project.name} application interface`}
            width={1600}
            height={1000}
            sizes={imageSizes.full}
            preload
            className={styles.mediaImage}
          />
        </div>
      </figure>

      {Boolean(project.gallery?.length) && (
        <section className={styles.gallery} aria-label={`${project.name} screenshots`}>
          {project.gallery?.map((image, index) => (
            <Image
              key={image}
              src={image}
              alt={`${project.name} screenshot ${index + 2}`}
              width={1600}
              height={1000}
              sizes={imageSizes.twoColumns}
            />
          ))}
        </section>
      )}
    </>
  );
}
