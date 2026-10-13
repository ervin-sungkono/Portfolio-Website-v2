import Link from 'next/link';
import type { ReactNode } from 'react';
import { SignOutButton } from './sign-out-button';
import { ThemeToggle } from './theme-toggle';
import styles from './admin-frame.module.css';

export type AdminSection = 'dashboard' | 'project' | 'design' | 'profile' | 'media' | 'security';
export type PublicSourceMode = 'static' | 'database';

const sections: readonly { id: AdminSection; label: string; href: string }[] = [
  { id: 'dashboard', label: 'Overview', href: '/admin' },
  { id: 'project', label: 'Projects', href: '/admin/content/project' },
  { id: 'design', label: 'Design work', href: '/admin/content/design' },
  { id: 'profile', label: 'Profile', href: '/admin/content/profile' },
  { id: 'media', label: 'Media library', href: '/admin/media' },
  { id: 'security', label: 'Account security', href: '/admin/security' },
];

export function AdminFrame({
  active,
  email,
  sourceMode,
  title,
  eyebrow,
  description,
  actions,
  notice,
  children,
}: {
  active: AdminSection;
  email: string;
  sourceMode: PublicSourceMode;
  title: string;
  eyebrow: string;
  description?: string;
  actions?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <aside className={styles.sidebar} aria-label="CMS navigation">
        <Link className={styles.brand} href="/admin" aria-label="Portfolio CMS overview">
          <span className={styles['brand-mark']} aria-hidden="true">
            E.
          </span>
          <span>
            <strong>PORTFOLIO</strong>
            <small>CONTENT STUDIO</small>
          </span>
        </Link>

        <p className={styles['nav-label']}>Workspace</p>
        <nav className={styles.navigation}>
          {sections.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              className={section.id === active ? styles['nav-link-active'] : styles['nav-link']}
              aria-current={section.id === active ? 'page' : undefined}
            >
              <span aria-hidden="true" className={styles['nav-glyph']}>
                {section.id === 'dashboard'
                  ? '01'
                  : section.id === 'project'
                    ? '02'
                    : section.id === 'design'
                      ? '03'
                      : section.id === 'profile'
                        ? '04'
                        : section.id === 'media'
                          ? '05'
                          : '06'}
              </span>
              {section.label}
            </Link>
          ))}
        </nav>

        <div className={styles['sidebar-footer']}>
          <span className={styles['owner-label']}>Signed in as</span>
          <span className={styles['owner-email']}>{email}</span>
          <Link className={styles['site-link']} href="/" target="_blank">
            View portfolio <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles['topbar-identity']}>
            <span className={styles['mobile-brand-mark']} aria-hidden="true">
              E.
            </span>
            <span className={styles['topbar-path']}>ERVIN CAHYADINATA SUNGKONO / CMS</span>
          </div>
          <div className={styles['topbar-actions']}>
            <Link className={styles['security-link']} href="/admin/security">
              Security
            </Link>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        <div className={styles.main}>
          <div className={styles['page-head']}>
            <div>
              <p className={styles.eyebrow}>{eyebrow}</p>
              <h1>{title}</h1>
              {description ? <p className={styles.description}>{description}</p> : null}
            </div>
            {actions ? <div className={styles['page-actions']}>{actions}</div> : null}
          </div>

          <div className={styles['source-notice']} role="status">
            <span className={styles['source-dot']} aria-hidden="true" />
            <span>
              Public portfolio source:{' '}
              <strong>{sourceMode === 'database' ? 'Database' : 'Static snapshot'}</strong>.
              {sourceMode === 'static'
                ? ' Drafts and publication changes are saved in the CMS, but the public site will continue to show the checked-in snapshot until database mode is enabled.'
                : ' The public site reads published entries from the CMS.'}
            </span>
          </div>

          {notice ? <div className={styles['page-notice']}>{notice}</div> : null}
          {children}
        </div>

        <footer className={styles.footer}>
          <span>PRIVATE EDITORIAL WORKSPACE</span>
          <span>Ervin Cahyadinata Sungkono · Portfolio CMS</span>
        </footer>
      </div>
    </div>
  );
}

export function AdminCentered({ children }: { children: ReactNode }) {
  return (
    <div className={styles['centered-main']}>
      <Link
        className={styles['centered-brand']}
        href="/"
        aria-label="Return to Ervin Cahyadinata Sungkono’s portfolio"
      >
        <span className={styles['brand-mark']} aria-hidden="true">
          E.
        </span>
        <span>
          <strong>PORTFOLIO</strong>
          <small>CONTENT STUDIO</small>
        </span>
      </Link>
      {children}
      <p className={styles['centered-footer']}>PRIVATE EDITORIAL WORKSPACE · NO PUBLIC SIGNUP</p>
    </div>
  );
}
