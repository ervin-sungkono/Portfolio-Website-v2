import { Suspense } from 'react';
import { CmsDraftProvider } from '@/components/admin/CmsDraftProvider';
import { Button } from '@/components/common/Button';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { auth, cmsAuthConfigured, signOut } from '@/lib/cms/auth';
import styles from './style.module.css';

async function AdminSignOut() {
  if (!cmsAuthConfigured() || !(await auth())?.user) {
    return null;
  }
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/admin' });
      }}
    >
      <Button kind="action" type="submit" className={styles.signOut}>
        Sign out
      </Button>
    </form>
  );
}

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${styles.page} admin-shell`}>
      <header className={styles.header}>
        <div>
          <h1>Content studio</h1>
          <p className={styles.notice}>
            Committed content and its history are public. Keep sensitive drafts local.
          </p>
        </div>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <div id="cms-header-actions" />
          <Suspense fallback={null}>
            <AdminSignOut />
          </Suspense>
        </div>
      </header>
      <CmsDraftProvider>{children}</CmsDraftProvider>
    </div>
  );
}
