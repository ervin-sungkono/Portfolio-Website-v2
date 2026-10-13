import type { Metadata } from 'next';
import { connection } from 'next/server';
import styles from './admin.module.css';

export const metadata: Metadata = {
  title: 'Portfolio CMS',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return (
    <>
      <a className={styles['skip-link']} href="#main">
        Skip to workspace
      </a>
      <main id="main" tabIndex={-1} className={styles.canvas}>
        {children}
      </main>
    </>
  );
}
