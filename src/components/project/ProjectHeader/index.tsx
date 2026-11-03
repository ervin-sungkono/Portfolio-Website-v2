import Link from 'next/link';
import { ArrowLeftIcon, ArrowUpRightIcon, GithubLogoIcon } from '@phosphor-icons/react/dist/ssr';
import { ExternalLink } from '@/components/common/ExternalLink';
import styles from './style.module.css';
import type { ProjectHeaderProps } from './type';

export function ProjectHeader({ project, study }: ProjectHeaderProps) {
  return (
    <section className={`page-heading project-detail-heading ${styles.projectHeader}`}>
      <Link href="/project" className={`text-link back-link ${styles.backLink}`}>
        <ArrowLeftIcon size={17} aria-hidden="true" /> All Projects
      </Link>
      <p className="editorial-label">{project.category}</p>
      <h1>{project.name}</h1>
      <p className={styles.projectDescription}>{project.description}</p>
      {study && <p className={`meta ${styles.focus}`}>Engineering Focus: {study.focus}</p>}
      <div className={`hero-actions ${styles.actions}`}>
        {project.demo && (
          <ExternalLink href={project.demo} className="button">
            Open Project <ArrowUpRightIcon size={18} aria-hidden="true" />
          </ExternalLink>
        )}
        {project.source && (
          <ExternalLink href={project.source} className="button button-outline">
            <GithubLogoIcon size={19} aria-hidden="true" /> View Source
          </ExternalLink>
        )}
      </div>
    </section>
  );
}
