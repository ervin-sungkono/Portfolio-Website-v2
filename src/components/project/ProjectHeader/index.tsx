import { ArrowLeftIcon, ArrowUpRightIcon, GithubLogoIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/common/Button';
import styles from './style.module.css';
import type { ProjectHeaderProps } from './type';

export function ProjectHeader({ project, study }: ProjectHeaderProps) {
  return (
    <section className={`page-heading project-detail-heading ${styles.projectHeader}`}>
      <Button
        kind="link"
        href="/project"
        variant="text"
        showArrow={false}
        className={`back-link ${styles.backLink}`}
      >
        <ArrowLeftIcon size={17} aria-hidden="true" /> All Projects
      </Button>
      <p className="editorial-label">{project.category}</p>
      <h1>{project.name}</h1>
      <p className={styles.projectDescription}>{project.description}</p>
      {study && <p className={`meta ${styles.focus}`}>Engineering Focus: {study.focus}</p>}
      <div className={`hero-actions ${styles.actions}`}>
        {project.demo && (
          <Button kind="external" href={project.demo} showArrow={false}>
            Open Project <ArrowUpRightIcon size={18} aria-hidden="true" />
          </Button>
        )}
        {project.source && (
          <Button kind="external" href={project.source} variant="outline" showArrow={false}>
            <GithubLogoIcon size={19} aria-hidden="true" /> View Source
          </Button>
        )}
      </div>
    </section>
  );
}
