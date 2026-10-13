import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminCentered } from '@/components/admin/admin-frame';
import { LoginForm } from '@/components/admin/login-form';
import { SetupPanel } from '@/components/admin/setup-panel';
import { getCmsSetupStatus } from '@/lib/cms/auth';
import { CmsSetupError, getOwnerSession } from '@/lib/cms/guards';

export const metadata: Metadata = { title: 'Sign in · Portfolio CMS' };

type AdminLoginSearchParams = {
  reauth?: string | string[];
  returnTo?: string | string[];
};

function getSafeReturnTo(value: string | string[] | undefined) {
  if (typeof value !== 'string') return '/admin';
  return /^\/admin(?:\/(?:editor|preview|content|new)\/[A-Za-z0-9_-]+|\/(?:media|security))?$/.test(
    value,
  )
    ? value
    : '/admin';
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<AdminLoginSearchParams>;
}) {
  const params = await searchParams;
  const reauth = params.reauth === '1';
  const returnTo = getSafeReturnTo(params.returnTo);
  const status = await getCmsSetupStatus();
  if (!status.ready) {
    return (
      <AdminCentered>
        <SetupPanel missing={status.missing} />
      </AdminCentered>
    );
  }

  let session = null;
  try {
    session = await getOwnerSession();
  } catch (error) {
    if (error instanceof CmsSetupError) {
      return (
        <AdminCentered>
          <SetupPanel
            missing={error.missing}
            message="The configured service could not establish a private CMS session. Editing and publishing remain disabled."
          />
        </AdminCentered>
      );
    }
  }
  if (session && !reauth) redirect(session.twoFactorEnabled ? '/admin' : '/admin/security');

  return (
    <AdminCentered>
      <LoginForm reauth={reauth} returnTo={returnTo} />
    </AdminCentered>
  );
}
