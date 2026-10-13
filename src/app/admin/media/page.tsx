import type { Metadata } from 'next';
import { AdminCentered, AdminFrame } from '@/components/admin/admin-frame';
import { MediaLibrary } from '@/components/admin/media-library';
import { SetupPanel } from '@/components/admin/setup-panel';
import { getOwnerPageAccess, getPublicSourceMode, isSetupState } from '../page-helpers';

export const metadata: Metadata = { title: 'Media library · Portfolio CMS' };

export default async function AdminMediaPage() {
  const access = await getOwnerPageAccess();
  if (isSetupState(access)) {
    return (
      <AdminCentered>
        <SetupPanel missing={access.missing} message={access.message} />
      </AdminCentered>
    );
  }

  return (
    <AdminFrame
      active="media"
      email={access.session.email}
      sourceMode={getPublicSourceMode()}
      eyebrow="Asset management"
      title="Media library."
      description="Upload and review verified artwork for projects, design studies, and profile content. Private storage references stay server-side."
    >
      <MediaLibrary />
    </AdminFrame>
  );
}
