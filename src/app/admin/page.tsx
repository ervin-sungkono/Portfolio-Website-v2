import { Suspense } from 'react';
import type { Metadata } from 'next';
import { auth, cmsAuthConfigured, isCurrentOwner, signIn } from '@/lib/cms/auth';
import { CmsEditor } from '@/components/admin/CmsEditor';
import { Button } from '@/components/common/Button';
import styles from './style.module.css';

export const metadata: Metadata = {
  title: 'Portfolio CMS',
  robots: { index: false, follow: false },
};

async function AdminWorkspace() {
  if (!cmsAuthConfigured()) {
    return (
      <p>
        Set AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, GITHUB_PAT, and GITHUB_REPO on the
        server to enable GitHub sign-in. See the repository setup guide.
      </p>
    );
  }
  const session = await auth();
  if (!(await isCurrentOwner(session?.user?.id))) {
    return (
      <form
        action={async () => {
          'use server';
          await signIn('github', { redirectTo: '/admin' });
        }}
      >
        <p>Sign in with the GitHub account configured by the server credential to edit content.</p>
        <Button kind="action" type="submit">
          Sign in with GitHub
        </Button>
      </form>
    );
  }
  return <CmsEditor />;
}

export default function AdminPage() {
  return (
    <>
      <Suspense
        fallback={
          <p className={styles.loading} role="status">
            Loading owner workspace…
          </p>
        }
      >
        <AdminWorkspace />
      </Suspense>
    </>
  );
}
