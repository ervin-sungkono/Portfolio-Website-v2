import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon, ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ProjectCard } from '@/components/common/ProjectCard';
import { Reveal } from '@/components/common/Reveal';
import { getDesigns, type Design, type Project } from '@/lib/content';
import { imageSizes } from '@/lib/image-sizes';
import styles from './style.module.css';

export async function SelectedProjects({ projects }: { projects: readonly Project[] }) {
  let designs: readonly Design[] = [];
  try {
    designs = await getDesigns();
  } catch {
    designs = [];
  }
  const design = designs[0];
  const [mainProject, secondaryProject, additionalProject] = projects;
  return (
    <section
      className={`selected section ${styles.selected}`}
      id="projects"
      aria-labelledby="selected-heading"
    >
      <Reveal className={`section-heading ${styles.sectionHeading}`}>
        <h2 id="selected-heading">Selected Projects.</h2>
        <p>Interfaces, integrations, and the engineering behind them.</p>
      </Reveal>
      <div className={styles.bentoGrid}>
        <div className={styles.primaryProject}>
          {mainProject && (
            <ProjectCard
              project={mainProject}
              featured
              index={1}
              sizes={imageSizes.homePrimary}
              parallaxTravel={1.5}
            />
          )}
        </div>
        <div className={styles.secondaryProject}>
          {secondaryProject && (
            <ProjectCard
              project={secondaryProject}
              index={2}
              sizes={imageSizes.homeSecondary}
              parallaxTravel={1}
            />
          )}
        </div>
        <div className={styles.additionalProject}>
          {additionalProject && (
            <ProjectCard
              project={additionalProject}
              index={3}
              sizes={imageSizes.homeAdditional}
              parallaxTravel={1}
            />
          )}
        </div>
        <Link href="/design" className={styles.designTeaser} data-cursor="link">
          <span className={styles.teaserKicker}>Interface studies</span>
          {design && (
            <div className={styles.teaserImage}>
              <Image
                src={design.image}
                alt=""
                width={1200}
                height={900}
                sizes={imageSizes.homeTeaser}
              />
            </div>
          )}
          <h3>Visual explorations.</h3>
          <p>A few web and mobile studies from the full design archive.</p>
          <span className={styles.teaserAction}>
            Explore designs <ArrowUpRightIcon size={18} aria-hidden="true" />
          </span>
        </Link>
      </div>
      <Link href="/project" className={`text-link section-link ${styles.collectionLink}`}>
        Explore Projects <ArrowRightIcon size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}
