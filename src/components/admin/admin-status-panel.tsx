import Link from 'next/link';
import styles from './admin-status-panel.module.css';

export function AdminStatusPanel({
  eyebrow = 'Request could not be completed',
  title,
  description,
  href,
  linkLabel,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <section className={styles.panel} aria-labelledby="admin-status-title">
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id="admin-status-title">{title}</h2>
      <p>{description}</p>
      {href && linkLabel ? (
        <Link className={styles.link} href={href}>
          {linkLabel}
        </Link>
      ) : null}
    </section>
  );
}
