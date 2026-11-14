import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/common/Button';
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
      <div className={styles.bentoGrid} data-project-count={Math.min(projects.length, 3)}>
        {mainProject && (
          <div className={styles.primaryProject}>
            <ProjectCard
              project={mainProject}
              featured
              index={1}
              sizes={imageSizes.homePrimary}
              parallaxTravel={1.5}
            />
          </div>
        )}
        {secondaryProject && (
          <div className={styles.secondaryProject}>
            <ProjectCard
              project={secondaryProject}
              index={2}
              sizes={imageSizes.homeSecondary}
              parallaxTravel={1}
            />
          </div>
        )}
        {additionalProject && (
          <div className={styles.additionalProject}>
            <ProjectCard
              project={additionalProject}
              index={3}
              sizes={imageSizes.homeAdditional}
              parallaxTravel={1}
            />
          </div>
        )}
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
      <Button
        kind="link"
        href="/project"
        variant="text"
        className={`section-link ${styles.collectionLink}`}
      >
        Explore Projects
      </Button>
    </section>
  );
}
