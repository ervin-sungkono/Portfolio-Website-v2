import Link from 'next/link';
import { ArrowUpRightIcon, ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import { engineeringCapabilities, findProject } from '@/lib/content';
import styles from './engineering.module.css';

export function EngineeringHighlights() {
  return (
    <section className={`section ${styles.highlights}`} aria-labelledby="engineering-heading">
      <div className={styles.intro}>
        <p className="eyebrow">Behind the Interface</p>
        <h2 id="engineering-heading">The Engineering in the Work.</h2>
        <p>Explore the workflows, integrations, and technical choices behind selected projects.</p>
        <Link href="/engineering" className="text-link">
          How This Site Is Built <ArrowRightIcon size={18} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.evidenceList}>
        {engineeringCapabilities.map((capability) => {
          const project = findProject(capability.projectSlug);
          if (!project) return null;
          return (
            <Link
              key={capability.projectSlug}
              href={`/project/${project.slug}#engineering`}
              className={styles.evidenceLink}
            >
              <div>
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
                <span className={styles.projectLabel}>{project.name} · Read Walkthrough</span>
              </div>
              <ArrowUpRightIcon size={22} aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
