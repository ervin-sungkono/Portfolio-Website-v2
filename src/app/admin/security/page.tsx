import type { Metadata } from 'next';
import { AdminCentered, AdminFrame } from '@/components/admin/admin-frame';
import { SetupPanel } from '@/components/admin/setup-panel';
import { TwoFactorSetup } from '@/components/admin/two-factor-setup';
import { getEnrollmentPageAccess, getPublicSourceMode, isSetupState } from '../page-helpers';

export const metadata: Metadata = { title: 'Account security · Portfolio CMS' };

export default async function AdminSecurityPage() {
  const access = await getEnrollmentPageAccess();
  if (isSetupState(access)) {
    return (
      <AdminCentered>
        <SetupPanel missing={access.missing} message={access.message} />
      </AdminCentered>
    );
  }

  return (
    <AdminFrame
      active="security"
      email={access.session.email}
      sourceMode={getPublicSourceMode()}
      eyebrow="Account security"
      title="Protect the studio."
      description="The private CMS requires a verified authenticator factor for every editing session."
    >
      <TwoFactorSetup enabled={access.session.twoFactorEnabled} />
    </AdminFrame>
  );
}
