import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { profile, skills } from '@/content/profile';
import { AdminCentered, AdminFrame } from '@/components/admin/admin-frame';
import { AdminStatusPanel } from '@/components/admin/admin-status-panel';
import { SetupPanel } from '@/components/admin/setup-panel';
import { ContentEditor } from '@/components/admin/content-editor';
import { isCmsKind, type CmsKind, type CmsPayload, type ProfilePayload } from '@/lib/cms/model';
import { listEntries } from '@/lib/cms/store';
import { listMediaAssets, type MediaSummary } from '@/lib/cms/media';
import { getOwnerPageAccess, getPublicSourceMode, isSetupState } from '../../page-helpers';
import styles from './new-entry.module.css';

const kindName = { project: 'project', design: 'design piece', profile: 'profile' } as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const { kind } = await params;
  return { title: `New ${isCmsKind(kind) ? kindName[kind] : 'content'} · Portfolio CMS` };
}

function blankPayload(kind: CmsKind): CmsPayload {
  if (kind === 'project') {
    const suffix = randomUUID().slice(0, 8);
    return {
      id: `project-${suffix}`,
      slug: `new-project-${suffix}`,
      name: '',
      description: '',
      image: '',
      topics: [],
      category: '',
      source: '',
      demo: null,
    };
  }
  if (kind === 'design') {
    return {
      id: `new-design-${randomUUID().slice(0, 8)}`,
      title: '',
      url: '',
      image: '',
      category: 'Web',
    };
  }
  return {
    ...(profile as ProfilePayload),
    experiences: profile.experiences.map((experience) => ({ ...experience })),
    education: { ...profile.education },
    skills: skills.map((skill) => ({ ...skill })),
  };
}

export default async function NewContentPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind: rawKind } = await params;
  if (!isCmsKind(rawKind)) notFound();
  const kind = rawKind;
  const access = await getOwnerPageAccess();
  if (isSetupState(access)) {
    return (
      <AdminCentered>
        <SetupPanel missing={access.missing} message={access.message} />
      </AdminCentered>
    );
  }

  let existingProfileId: string | undefined;
  try {
    if (kind === 'profile')
      existingProfileId = (await listEntries()).find((entry) => entry.kind === 'profile')?.id;
  } catch {
    return (
      <AdminFrame
        active={kind}
        email={access.session.email}
        sourceMode={getPublicSourceMode()}
        eyebrow="New profile"
        title="The profile library is unavailable."
      >
        <AdminStatusPanel
          title="The current profile could not be checked."
          description="The CMS cannot verify whether a profile draft already exists. Check the database setup, then try again."
          href="/admin/content/profile"
          linkLabel="Back to profile"
        />
      </AdminFrame>
    );
  }
  if (existingProfileId) redirect(`/admin/editor/${existingProfileId}`);

  let media: MediaSummary[] = [];
  let mediaUnavailable = false;
  try {
    media = await listMediaAssets(access.session.userId);
  } catch {
    mediaUnavailable = true;
  }
  try {
    return (
      <AdminFrame
        active={kind}
        email={access.session.email}
        sourceMode={getPublicSourceMode()}
        eyebrow={`New ${kindName[kind]}`}
        title="Start with a clear draft."
        description={
          kind === 'profile'
            ? 'This draft starts from the portfolio profile snapshot; saving it does not change the public site.'
            : 'Build a structured entry. Your work stays private until you publish it.'
        }
        actions={
          <Link className={styles['back-link']} href={`/admin/content/${kind}`}>
            Back to{' '}
            {kind === 'project' ? 'projects' : kind === 'design' ? 'design work' : 'profile'}
          </Link>
        }
      >
        {mediaUnavailable ? (
          <p className={styles['media-notice']} role="status">
            The saved image library could not be loaded. You can still edit the content fields;
            retry after media storage is available to choose or upload artwork.
          </p>
        ) : null}
        <ContentEditor
          key={`new-${kind}`}
          kind={kind}
          initialPayload={blankPayload(kind)}
          initialEntry={null}
          initialRequestId={randomUUID()}
          availableMedia={media.filter(
            (asset): asset is MediaSummary & { state: 'verified' | 'published' } =>
              asset.state === 'verified' || asset.state === 'published',
          )}
          availableSkillIcons={skills.map((skill) => skill.icon)}
        />
      </AdminFrame>
    );
  } catch {
    return (
      <AdminFrame
        active={kind}
        email={access.session.email}
        sourceMode={getPublicSourceMode()}
        eyebrow={`New ${kindName[kind]}`}
        title="A draft could not be started."
      >
        <AdminStatusPanel
          title="The content library could not be read."
          description="The CMS is unavailable right now. Check the database setup and try again."
          href={`/admin/content/${kind}`}
          linkLabel="Back to content"
        />
      </AdminFrame>
    );
  }
}
