import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AdminCentered, AdminFrame } from '@/components/admin/admin-frame';
import { AdminStatusPanel } from '@/components/admin/admin-status-panel';
import { SetupPanel } from '@/components/admin/setup-panel';
import { ContentEditor } from '@/components/admin/content-editor';
import { getOwnerPageAccess, getPublicSourceMode, isSetupState } from '../../page-helpers';
import { readEntry } from '@/lib/cms/store';
import { listMediaAssets, type MediaSummary } from '@/lib/cms/media';
import { randomUUID } from 'node:crypto';
import styles from './editor-page.module.css';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kindLabel = { project: 'Project', design: 'Design work', profile: 'Profile' } as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const access = await getOwnerPageAccess();
  if (isSetupState(access) || !UUID_PATTERN.test(id))
    return { title: 'Edit content · Portfolio CMS' };
  try {
    const entry = await readEntry(id);
    return {
      title: entry ? `Edit ${entry.title} · Portfolio CMS` : 'Edit content · Portfolio CMS',
    };
  } catch {
    return { title: 'Edit content · Portfolio CMS' };
  }
}

export default async function AdminEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const access = await getOwnerPageAccess();
  if (isSetupState(access)) {
    return (
      <AdminCentered>
        <SetupPanel missing={access.missing} message={access.message} />
      </AdminCentered>
    );
  }

  let entry;
  try {
    entry = await readEntry(id);
  } catch {
    return (
      <AdminFrame
        active="dashboard"
        email={access.session.email}
        sourceMode={getPublicSourceMode()}
        eyebrow="Content editor"
        title="Content is temporarily unavailable."
      >
        <AdminStatusPanel
          title="The saved draft could not be read."
          description="The CMS never substitutes checked-in content when the database is unavailable. Check the service setup and reload this entry."
          href={`/admin/editor/${id}`}
          linkLabel="Reload draft"
        />
      </AdminFrame>
    );
  }
  if (!entry) notFound();

  let media: MediaSummary[] = [];
  try {
    media = await listMediaAssets(access.session.userId);
  } catch {
    // Editing text and legacy images remains possible while media services are offline.
  }
  const currentImage = 'image' in entry.payload ? entry.payload.image : '';
  const match = /^\/media\/published\/([0-9a-f-]{36})\/([a-f0-9]{64})$/.exec(currentImage);
  const currentAsset = match
    ? media.find(
        (asset) =>
          asset.id === match[1] &&
          asset.version === match[2] &&
          (asset.state === 'verified' || asset.state === 'published'),
      )
    : undefined;
  const initialMedia =
    currentAsset?.url && currentAsset.width && currentAsset.height
      ? {
          assetId: currentAsset.id,
          version: currentAsset.version,
          state: currentAsset.state as 'verified' | 'published',
          url: currentAsset.url,
          previewUrl: currentAsset.previewUrl,
          alt: currentAsset.alt,
          width: currentAsset.width,
          height: currentAsset.height,
        }
      : null;

  return (
    <AdminFrame
      active={entry.kind}
      email={access.session.email}
      sourceMode={getPublicSourceMode()}
      eyebrow={`${kindLabel[entry.kind]} editor · revision ${entry.draftRevision}`}
      title={entry.title}
      description="Edit the structured draft, review its history, and publish the saved revision when it is ready."
    >
      {entry.archived ? (
        <p className={styles['archived-notice']} role="status">
          This entry is archived. Its history remains available, and it cannot be published.
        </p>
      ) : null}
      <ContentEditor
        kind={entry.kind}
        initialPayload={entry.payload}
        initialEntry={entry}
        initialRequestId={randomUUID()}
        availableMedia={media.filter(
          (asset): asset is MediaSummary & { state: 'verified' | 'published' } =>
            asset.state === 'verified' || asset.state === 'published',
        )}
        initialMedia={initialMedia}
        availableSkillIcons={[
          'react',
          'nextjs',
          'js',
          'html',
          'css',
          'tailwind',
          'sass',
          'git',
          'figma',
          'nodejs',
          'laravel',
          'mysql',
          'java',
          'androidstudio',
          'bootstrap',
        ]}
      />
    </AdminFrame>
  );
}
