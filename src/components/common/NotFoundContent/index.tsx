import Link from 'next/link';
import type { NotFoundContentProps } from './type';
import styles from './style.module.css';

export function NotFoundContent({
  description = 'Explore the projects or return to the homepage.',
  href = '/project',
  linkLabel = 'Explore Projects',
}: NotFoundContentProps) {
  return (
    <section className={styles.page} data-not-found aria-labelledby="not-found-heading">
      <div className={styles.copy}>
        <p className={styles.code} aria-hidden="true">
          404
        </p>
        <p className="eyebrow">404 / Page Not Found</p>
        <h1 id="not-found-heading">This Page Isn’t Here.</h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.actions}>
          <Link href="/" className="button">
            Back to Home
          </Link>
          <Link href={href} className="text-link">
            {linkLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
