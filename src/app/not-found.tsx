import Link from 'next/link';
import { ParticleAccent } from '@/components/particle-accent';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <section className={styles.page} data-not-found aria-labelledby="not-found-heading">
      <div className={styles.copy}>
        <p className={styles.code} aria-hidden="true">
          404
        </p>
        <p className="eyebrow">404 / Page Not Found</p>
        <h1 id="not-found-heading">This Page Isn’t Here.</h1>
        <p className={styles.description}>Explore the projects or return to the homepage.</p>
        <div className={styles.actions}>
          <Link href="/" className="button">
            Back to Home
          </Link>
          <Link href="/project" className="text-link">
            Explore Projects
          </Link>
        </div>
      </div>
      <ParticleAccent />
    </section>
  );
}
