import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { DesignPayload, ProfilePayload, ProjectPayload } from '@/lib/cms/model';
import { listMediaAssets } from '@/lib/cms/media';
import type { MediaSummary } from '@/lib/cms/media';
import { readEntry } from '@/lib/cms/store';
import { AdminCentered, AdminFrame } from '@/components/admin/admin-frame';
import { AdminStatusPanel } from '@/components/admin/admin-status-panel';
import { SetupPanel } from '@/components/admin/setup-panel';
import { getOwnerPageAccess, getPublicSourceMode, isSetupState } from '../../page-helpers';
import styles from './preview-page.module.css';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: 'Private content preview · Portfolio CMS' };

export default async function AdminPreviewPage({ params }: { params: Promise<{ id: string }> }) {
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
        eyebrow="Private preview"
        title="The saved draft is unavailable."
      >
        <AdminStatusPanel
          title="The content store could not be read."
          description="This preview never falls back to public or checked-in content. Check the database setup and try again."
          href={`/admin/preview/${id}`}
          linkLabel="Reload preview"
        />
      </AdminFrame>
    );
  }
  if (!entry) notFound();

  let media: MediaSummary[] = [];
  try {
    media = await listMediaAssets(access.session.userId);
  } catch {
    // Text preview remains useful if the media service is temporarily unavailable.
  }
  const image = 'image' in entry.payload ? entry.payload.image : '';
  const reference = /^\/media\/published\/([0-9a-f-]{36})\/([a-f0-9]{64})$/.exec(image);
  const currentMedia = reference
    ? media.find(
        (asset) =>
          asset.id === reference[1] &&
          asset.version === reference[2] &&
          (asset.state === 'verified' || asset.state === 'published'),
      )
    : undefined;
  const previewImage = reference ? `/api/admin/media/${reference[1]}` : image;
  const imageAlt = currentMedia?.alt || `Cover image for ${entry.title}`;
  const width = currentMedia?.width || 1200;
  const height = currentMedia?.height || 760;

  return (
    <AdminFrame
      active={entry.kind}
      email={access.session.email}
      sourceMode={getPublicSourceMode()}
      eyebrow={`Private preview · draft revision ${entry.draftRevision}`}
      title={entry.title}
      description="This view contains saved draft content and is visible only to the verified owner."
      actions={
        <Link className={styles['back-button']} href={`/admin/editor/${entry.id}`}>
          Back to editor
        </Link>
      }
      notice={
        <span>
          PRIVATE PREVIEW <strong>Not indexed or cached</strong>
        </span>
      }
    >
      <section className={styles['preview-sheet']} aria-label="Saved content preview">
        <div className={styles['preview-meta']}>
          <span>{kindLabel(entry.kind)}</span>
          <span>
            {entry.publishedRevision
              ? `Published revision ${entry.publishedRevision}`
              : 'Draft only'}
          </span>
          <span>Draft revision {entry.draftRevision}</span>
        </div>
        {entry.kind === 'project' ? (
          <ProjectPreview
            payload={entry.payload as ProjectPayload}
            image={previewImage}
            imageAlt={imageAlt}
            width={width}
            height={height}
          />
        ) : entry.kind === 'design' ? (
          <DesignPreview
            payload={entry.payload as DesignPayload}
            image={previewImage}
            imageAlt={imageAlt}
            width={width}
            height={height}
          />
        ) : (
          <ProfilePreview payload={entry.payload as ProfilePayload} />
        )}
      </section>
      <div className={styles['preview-footer']}>
        <span>Saved {formatDate(entry.updatedAt)}</span>
        <Link href={`/admin/editor/${entry.id}`}>
          Continue editing <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </AdminFrame>
  );
}

function kindLabel(kind: string) {
  return kind === 'project' ? 'Project' : kind === 'design' ? 'Design piece' : 'Profile';
}

function ProjectPreview({
  payload,
  image,
  imageAlt,
  width,
  height,
}: {
  payload: ProjectPayload;
  image: string;
  imageAlt: string;
  width: number;
  height: number;
}) {
  return (
    <article className={styles.project}>
      <div className={styles['project-heading']}>
        <p className={styles.eyebrow}>{payload.category}</p>
        <h2>{payload.name}</h2>
        <p>{payload.description}</p>
        <ul className={styles.topics}>
          {payload.topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
        <div className={styles.links}>
          <a href={payload.source} target="_blank" rel="noreferrer">
            Source code <span aria-hidden="true">↗</span>
          </a>
          {payload.demo ? (
            <a href={payload.demo} target="_blank" rel="noreferrer">
              Live demo <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </div>
      </div>
      <div className={styles['cover-image']}>
        {image ? (
          <Image src={image} unoptimized alt={imageAlt} width={width} height={height} priority />
        ) : (
          <div className={styles['empty-image']}>No cover image selected</div>
        )}
      </div>
      {payload.study ? <StudyPreview study={payload.study} /> : null}
    </article>
  );
}

function StudyPreview({ study }: { study: NonNullable<ProjectPayload['study']> }) {
  return (
    <section className={styles.study} aria-labelledby="preview-study-title">
      <div>
        <p className={styles.eyebrow}>Project study</p>
        <h3 id="preview-study-title">{study.focus}</h3>
      </div>
      <div className={styles['study-copy']}>
        <section>
          <h4>Context</h4>
          <p>{study.context}</p>
        </section>
        <section>
          <h4>Challenge</h4>
          <p>{study.challenge}</p>
        </section>
        {study.highlights.length ? (
          <section>
            <h4>Highlights</h4>
            <ul>
              {study.highlights.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {study.decisions.length ? (
          <section className={styles.decisions}>
            <h4>Engineering decisions</h4>
            {study.decisions.map((decision, index) => (
              <article key={`${index}-${decision.title}`}>
                <h5>{decision.title}</h5>
                <p>{decision.implementation}</p>
                <small>Tradeoff · {decision.tradeoff}</small>
              </article>
            ))}
          </section>
        ) : null}
        <section>
          <h4>Next step</h4>
          <p>{study.nextStep}</p>
        </section>
        <a href={study.reference.href} target="_blank" rel="noreferrer">
          {study.reference.label} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}

function DesignPreview({
  payload,
  image,
  imageAlt,
  width,
  height,
}: {
  payload: DesignPayload;
  image: string;
  imageAlt: string;
  width: number;
  height: number;
}) {
  return (
    <article className={styles.design}>
      <p className={styles.eyebrow}>{payload.category} design</p>
      <h2>{payload.title}</h2>
      <a className={styles['design-link']} href={payload.url} target="_blank" rel="noreferrer">
        Open complete design <span aria-hidden="true">↗</span>
      </a>
      <div className={styles['cover-image']}>
        {image ? (
          <Image src={image} unoptimized alt={imageAlt} width={width} height={height} priority />
        ) : (
          <div className={styles['empty-image']}>No cover image selected</div>
        )}
      </div>
    </article>
  );
}

function ProfilePreview({ payload }: { payload: ProfilePayload }) {
  return (
    <article className={styles.profile}>
      <p className={styles.eyebrow}>Portfolio profile</p>
      <h2>{payload.name}</h2>
      <p className={styles['profile-title']}>{payload.title}</p>
      <p className={styles['profile-intro']}>{payload.intro}</p>
      <div className={styles.links}>
        <a href={payload.linkedin} target="_blank" rel="noreferrer">
          LinkedIn <span aria-hidden="true">↗</span>
        </a>
        <a href={payload.github} target="_blank" rel="noreferrer">
          GitHub <span aria-hidden="true">↗</span>
        </a>
        <a href={payload.dribbble} target="_blank" rel="noreferrer">
          Dribbble <span aria-hidden="true">↗</span>
        </a>
        <a href={payload.instagram} target="_blank" rel="noreferrer">
          Instagram <span aria-hidden="true">↗</span>
        </a>
        <a href={payload.cv} target="_blank" rel="noreferrer">
          CV <span aria-hidden="true">↗</span>
        </a>
      </div>
      <section className={styles['profile-section']} aria-labelledby="preview-experience-title">
        <p className={styles.eyebrow}>Experience</p>
        <h3 id="preview-experience-title">Work history</h3>
        {payload.experiences.map((experience, index) => (
          <article className={styles.experience} key={`${index}-${experience.company}`}>
            <div>
              <h4>{experience.role}</h4>
              <strong>{experience.company}</strong>
              <time>
                {experience.start} — {experience.end || 'Present'}
              </time>
            </div>
            <p>{experience.description}</p>
          </article>
        ))}
      </section>
      <section className={styles['profile-section']} aria-labelledby="preview-education-title">
        <p className={styles.eyebrow}>Education</p>
        <h3 id="preview-education-title">Academic background</h3>
        <div className={styles.education}>
          <strong>{payload.education.school}</strong>
          <span>{payload.education.degree}</span>
          <time>{payload.education.years}</time>
        </div>
      </section>
      <section className={styles['profile-section']} aria-labelledby="preview-skills-title">
        <p className={styles.eyebrow}>Capabilities</p>
        <h3 id="preview-skills-title">Tools and technologies</h3>
        <ul className={styles.topics}>
          {payload.skills.map((skill) => (
            <li key={`${skill.icon}-${skill.label}`}>{skill.label}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
