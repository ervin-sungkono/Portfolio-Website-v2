import { Suspense } from 'react';
import type { Metadata } from 'next';
import { GitHubImport } from '@/components/admin/GitHubImport';
import { Button } from '@/components/common/Button';
import { auth, cmsAuthConfigured, isCurrentOwner, signIn } from '@/lib/cms/auth';

export const metadata: Metadata = {
  title: 'Import GitHub project',
  robots: { index: false, follow: false },
};

async function ImportWorkspace() {
  if (!cmsAuthConfigured()) {
    return (
      <p>
        Set AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, GITHUB_PAT, and GITHUB_REPO on the
        server to enable the GitHub importer. See the repository setup guide.
      </p>
    );
  }

  const session = await auth();
  if (!(await isCurrentOwner(session?.user?.id))) {
    return (
      <form
        action={async () => {
          'use server';
          await signIn('github', { redirectTo: '/admin/import' });
        }}
      >
        <p>Sign in as the configured GitHub owner to map repositories to portfolio projects.</p>
        <Button kind="action" type="submit">
          Sign in with GitHub
        </Button>
      </form>
    );
  }

  return <GitHubImport />;
}

export default function AdminImportPage() {
  return (
    <div>
      <div className="section-heading">
        <p className="eyebrow">Owner workspace</p>
        <h2>Import from GitHub</h2>
        <p>
          Review an accessible repository’s verified metadata, then create a project or connect it
          to an existing one.
        </p>
      </div>
      <Suspense fallback={<p role="status">Loading GitHub importer…</p>}>
        <ImportWorkspace />
      </Suspense>
    </div>
  );
}
