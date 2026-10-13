import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AdminCentered, AdminFrame } from '@/components/admin/admin-frame';
import { AdminStatusPanel } from '@/components/admin/admin-status-panel';
import { ContentEntryList } from '@/components/admin/content-entry-list';
import { SetupPanel } from '@/components/admin/setup-panel';
import { isCmsKind } from '@/lib/cms/model';
import { listEntries } from '@/lib/cms/store';
import { getOwnerPageAccess, getPublicSourceMode, isSetupState } from '../../page-helpers';
import styles from './content-page.module.css';

const kindName = { project: 'Projects', design: 'Design work', profile: 'Profile' } as const;
const kindDescriptions = {
  project: 'Case studies, engineering details, and featured work.',
  design: 'The visual archive of interface and product design.',
  profile: 'The portfolio introduction, experience, education, and skills.',
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const { kind } = await params;
  return { title: `${isCmsKind(kind) ? kindName[kind] : 'Content'} · Portfolio CMS` };
}

export default async function AdminContentKindPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!isCmsKind(kind)) notFound();

  const access = await getOwnerPageAccess();
  if (isSetupState(access)) {
    return (
      <AdminCentered>
        <SetupPanel missing={access.missing} message={access.message} />
      </AdminCentered>
    );
  }

  try {
    const entries = (await listEntries()).filter((entry) => entry.kind === kind);
    return (
      <AdminFrame
        active={kind}
        email={access.session.email}
        sourceMode={getPublicSourceMode()}
        eyebrow="Content library"
        title={kindName[kind]}
        description={kindDescriptions[kind]}
        actions={
          kind === 'profile' && entries.length ? undefined : (
            <Link className={styles['new-button']} href={`/admin/new/${kind}`}>
              {kind === 'profile'
                ? 'Create profile draft'
                : `New ${kind === 'project' ? 'project' : 'design'}`}
            </Link>
          )
        }
      >
        <div className={styles['list-summary']}>
          <p>
            <strong>{entries.length}</strong> {entries.length === 1 ? 'entry' : 'entries'}
          </p>
          {kind === 'profile' && entries.length ? (
            <p>The profile is a singleton and keeps one editable draft.</p>
          ) : null}
          {kind !== 'profile' && entries.length ? (
            <p>Adjust display order from each entry’s editor.</p>
          ) : null}
        </div>
        <ContentEntryList
          entries={entries}
          kind={kind}
          emptyTitle={`No ${kind === 'project' ? 'projects' : kind === 'design' ? 'design pieces' : 'profile'} yet.`}
          emptyDescription="Create a structured draft, preview it privately, and publish only when it is ready."
        />
      </AdminFrame>
    );
  } catch {
    return (
      <AdminFrame
        active={kind}
        email={access.session.email}
        sourceMode={getPublicSourceMode()}
        eyebrow="Content library"
        title={`${kindName[kind]} unavailable`}
      >
        <AdminStatusPanel
          title="The content store could not be read."
          description="The CMS never substitutes checked-in content when database mode is unavailable. Check the database setup and reload this list."
          href={`/admin/content/${kind}`}
          linkLabel="Reload list"
        />
      </AdminFrame>
    );
  }
}
