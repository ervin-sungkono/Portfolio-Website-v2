import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { auth, cmsAuthConfigured, isCurrentOwner, signIn, signOut } from '@/lib/cms/auth';
import { CmsEditor } from '@/components/admin/CmsEditor';

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
        <button className="button" type="submit">
          Sign in with GitHub
        </button>
      </form>
    );
  }
  return (
    <>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/admin' });
        }}
      >
        <button className="button button-outline" type="submit">
          Sign out
        </button>
      </form>
      <p>
        <Link className="button button-outline" href="/admin/import">
          Import repository
        </Link>
      </p>
      <CmsEditor />
    </>
  );
}

export default function AdminPage() {
  return (
    <div className="container section">
      <h1>Portfolio CMS</h1>
      <p>
        Committed content and images are public, including unpublished projects and their history.
        Keep sensitive drafts local.
      </p>
      <Suspense fallback={<p role="status">Loading owner workspace…</p>}>
        <AdminWorkspace />
      </Suspense>
    </div>
  );
}
