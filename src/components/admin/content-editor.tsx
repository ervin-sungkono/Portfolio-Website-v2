'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  cloneElement,
  isValidElement,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type {
  CmsKind,
  CmsPayload,
  DesignPayload,
  ProfilePayload,
  ProjectPayload,
  ProjectStudyPayload,
} from '@/lib/cms/model';
import type { CmsEntryDetail, CmsRevision } from '@/lib/cms/store';
import {
  publishAction,
  restoreAction,
  saveDraftAction,
  unpublishAction,
  type MutationActionResult,
} from '@/lib/cms/actions';
import { MediaUpload, type MediaUploadValue } from './media-upload';
import styles from './content-editor.module.css';

type EditorMedia = {
  id: string;
  version: string;
  state: 'verified' | 'published';
  mime: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  alt: string;
  url: string | null;
  previewUrl: string;
  createdAt: string;
};

type EditorEntry = Pick<
  CmsEntryDetail,
  'id' | 'slug' | 'position' | 'draftRevision' | 'publishedRevision' | 'archived' | 'history'
>;

type ContentEditorProps = {
  kind: CmsKind;
  initialPayload: CmsPayload;
  initialEntry: EditorEntry | null;
  initialRequestId: string;
  availableMedia: EditorMedia[];
  initialMedia?: MediaUploadValue | null;
  availableSkillIcons: string[];
};

const EMPTY_ACTION_STATE = { status: 'idle' as const, message: '' };

function emptyStudy(): ProjectStudyPayload {
  return {
    focus: '',
    context: '',
    challenge: '',
    highlights: [],
    decisions: [],
    nextStep: '',
    reference: { label: '', href: '' },
  };
}

function valueForMedia(asset: EditorMedia): MediaUploadValue | null {
  if (!asset.url || !asset.width || !asset.height) return null;
  return {
    assetId: asset.id,
    version: asset.version,
    url: asset.url,
    previewUrl: asset.previewUrl,
    alt: asset.alt,
    width: asset.width,
    height: asset.height,
    state: asset.state,
  };
}

function mediaReference(path: string) {
  const match = /^\/media\/published\/([0-9a-f-]{36})\/([a-f0-9]{64})$/.exec(path);
  return match ? { id: match[1], version: match[2] } : null;
}

function reauthenticationHref(returnTo: string) {
  return `/admin/login?reauth=1&returnTo=${encodeURIComponent(returnTo)}`;
}

function fieldIdForIssue(kind: CmsKind, path: string) {
  const fixedFields: Partial<Record<CmsKind, Record<string, string>>> = {
    project: {
      name: 'project-name',
      slug: 'project-slug',
      category: 'project-category',
      description: 'project-description',
      image: 'existing-image',
      source: 'project-source',
      demo: 'project-demo',
      'study.focus': 'study-focus',
      'study.context': 'study-context',
      'study.challenge': 'study-challenge',
      'study.highlights': 'study-highlights',
      'study.nextStep': 'study-next',
      'study.reference.label': 'study-reference-label',
      'study.reference.href': 'study-reference-href',
    },
    design: {
      title: 'design-title',
      id: 'design-id',
      category: 'design-category',
      url: 'design-url',
      image: 'existing-image',
    },
    profile: {
      name: 'profile-name',
      title: 'profile-title',
      intro: 'profile-intro',
      linkedin: 'profile-linkedin',
      github: 'profile-github',
      dribbble: 'profile-dribbble',
      instagram: 'profile-instagram',
      cv: 'profile-cv',
      'education.school': 'education-school',
      'education.degree': 'education-degree',
      'education.years': 'education-years',
    },
  };
  const direct = fixedFields[kind]?.[path];
  if (direct) return direct;
  if (kind === 'project' && path.startsWith('topics.')) return 'project-topics';
  if (kind === 'project' && path.startsWith('study.highlights.')) return 'study-highlights';

  const decision = /^study\.decisions\.(\d+)\.(title|implementation|tradeoff)$/.exec(path);
  if (kind === 'project' && decision) return `decision-${decision[1]}-${decision[2]}`;

  const experience = /^experiences\.(\d+)\.(company|role|start|end|description)$/.exec(path);
  if (kind === 'profile' && experience) return `experience-${experience[1]}-${experience[2]}`;

  const skill = /^skills\.(\d+)\.(label|icon)$/.exec(path);
  if (kind === 'profile' && skill) return `skill-${skill[1]}-${skill[2]}`;

  return 'content-form-errors';
}

export function ContentEditor({
  kind,
  initialPayload,
  initialEntry,
  initialRequestId,
  availableMedia,
  initialMedia = null,
  availableSkillIcons,
}: ContentEditorProps) {
  const router = useRouter();
  const [payload, setPayload] = useState<CmsPayload>(initialPayload);
  const [position, setPosition] = useState(initialEntry?.position ?? 0);
  const [positionInput, setPositionInput] = useState(String((initialEntry?.position ?? 0) + 1));
  const [entryId, setEntryId] = useState(initialEntry?.id ?? '');
  const [expectedRevision, setExpectedRevision] = useState(
    initialEntry ? String(initialEntry.draftRevision) : '',
  );
  const [publishedRevision, setPublishedRevision] = useState(
    initialEntry?.publishedRevision ?? null,
  );
  const [requestId, setRequestId] = useState(initialRequestId);
  const [editVersion, setEditVersion] = useState(0);
  const [savedEditVersion, setSavedEditVersion] = useState(initialEntry ? 0 : -1);
  const [selectedMedia, setSelectedMedia] = useState<MediaUploadValue | null>(
    initialMedia ??
      (() => {
        const reference = mediaReference('image' in initialPayload ? initialPayload.image : '');
        if (!reference) return null;
        const asset = availableMedia.find(
          (candidate) => candidate.id === reference.id && candidate.version === reference.version,
        );
        return asset ? valueForMedia(asset) : null;
      })(),
  );
  const [actionState, formAction, isSaving] = useActionState(saveDraftAction, EMPTY_ACTION_STATE);
  const submittedEditVersion = useRef(0);
  const processedSaveId = useRef('');
  const saveLock = useRef(false);
  const mutationLock = useRef(false);
  const restoreLock = useRef(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [mutationMessage, setMutationMessage] = useState('');
  const [mutationError, setMutationError] = useState(false);
  const [mutationConflict, setMutationConflict] = useState(false);
  const [mutationReauthRequired, setMutationReauthRequired] = useState(false);

  useEffect(() => {
    setPublishedRevision(initialEntry?.publishedRevision ?? null);
  }, [initialEntry?.publishedRevision]);

  useEffect(() => {
    if (!isSaving) saveLock.current = false;
  }, [isSaving]);

  useEffect(() => {
    if (
      actionState.status !== 'saved' ||
      !actionState.entryId ||
      !actionState.draftRevision ||
      !actionState.requestId
    )
      return;
    if (processedSaveId.current === actionState.requestId) return;
    processedSaveId.current = actionState.requestId;
    setEntryId(actionState.entryId);
    setExpectedRevision(String(actionState.draftRevision));
    setRequestId(actionState.requestId);
    setSavedEditVersion(submittedEditVersion.current);
    if (editVersion === submittedEditVersion.current) {
      if (!initialEntry) router.replace(`/admin/editor/${actionState.entryId}`);
    }
  }, [actionState, editVersion, initialEntry, router]);

  const isNew = !entryId;
  const isDirty = isNew || editVersion !== savedEditVersion;
  const slug =
    kind === 'project'
      ? (payload as ProjectPayload).slug
      : kind === 'design'
        ? (payload as DesignPayload).id
        : 'profile';
  const title =
    kind === 'project'
      ? (payload as ProjectPayload).name || 'Untitled project'
      : kind === 'design'
        ? (payload as DesignPayload).title || 'Untitled design'
        : 'Profile';
  const isPublished = publishedRevision !== null;
  const isCurrentRevisionPublished = isPublished && publishedRevision === Number(expectedRevision);
  const canPublish = Boolean(
    entryId &&
      expectedRevision &&
      !isDirty &&
      !isCurrentRevisionPublished &&
      !initialEntry?.archived,
  );
  const hasIssues = actionState.status === 'error' || actionState.status === 'conflict';

  useEffect(() => {
    if (
      (actionState.status !== 'error' && actionState.status !== 'conflict') ||
      editVersion !== submittedEditVersion.current
    ) {
      return;
    }
    const firstIssue = actionState.issues?.[0];
    const targetId = firstIssue ? fieldIdForIssue(kind, firstIssue.path) : 'content-form-errors';
    const target = document.getElementById(targetId);
    if (target instanceof HTMLElement) target.focus();
  }, [actionState, editVersion, kind]);

  function update(next: CmsPayload) {
    if (restoreLock.current) return;
    setPayload(next);
    setEditVersion((version) => version + 1);
    setMutationMessage('');
    setMutationConflict(false);
    setMutationReauthRequired(false);
  }

  function setDisplayPosition(value: string) {
    if (restoreLock.current) return;
    setPositionInput(value);
    if (!value.trim()) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setPosition(Math.min(1_000_000, Math.max(0, Math.floor(parsed) - 1)));
    setEditVersion((version) => version + 1);
    setMutationMessage('');
    setMutationConflict(false);
    setMutationReauthRequired(false);
  }

  function updateProject(patch: Partial<ProjectPayload>) {
    if (kind !== 'project') return;
    const current = payload as ProjectPayload;
    update({ ...current, ...patch });
  }

  function updateDesign(patch: Partial<DesignPayload>) {
    if (kind !== 'design') return;
    const current = payload as DesignPayload;
    const next = { ...current, ...patch };
    if ('id' in patch) next.id = patch.id ?? next.id;
    update(next);
  }

  function updateProfile(patch: Partial<ProfilePayload>) {
    if (kind !== 'profile') return;
    update({ ...(payload as ProfilePayload), ...patch });
  }

  function setImage(image: string, mediaValue: MediaUploadValue | null) {
    if (restoreLock.current) return;
    setSelectedMedia(mediaValue);
    if (kind === 'project') updateProject({ image });
    else if (kind === 'design') updateDesign({ image });
  }

  function hasIssue(path: string) {
    return (
      actionState.issues?.some(
        (issue) => issue.path === path || issue.path.startsWith(`${path}.`),
      ) ?? false
    );
  }

  function runMutation(
    action: (formData: FormData) => Promise<MutationActionResult>,
    formData: FormData,
    restoring = false,
  ) {
    if (mutationLock.current || saveLock.current || isMutating) return;
    mutationLock.current = true;
    setIsRestoring(restoring);
    setIsMutating(true);
    setMutationMessage('');
    setMutationError(false);
    setMutationConflict(false);
    setMutationReauthRequired(false);
    startTransition(async () => {
      try {
        const result = await action(formData);
        setMutationMessage(result.message);
        setMutationError(!result.ok);
        setMutationConflict(Boolean(result.conflict));
        setMutationReauthRequired(Boolean(result.reauthRequired));
        if (result.ok && result.restoredDraft) {
          setPayload(result.restoredDraft.payload);
          setPosition(result.restoredDraft.position);
          setPositionInput(String(result.restoredDraft.position + 1));
          setExpectedRevision(String(result.restoredDraft.draftRevision));
          setSavedEditVersion(editVersion);
          if (result.requestId) setRequestId(result.requestId);

          const image =
            'image' in result.restoredDraft.payload ? result.restoredDraft.payload.image : '';
          const reference = mediaReference(image);
          const asset = reference
            ? availableMedia.find(
                (candidate) =>
                  candidate.id === reference.id && candidate.version === reference.version,
              )
            : undefined;
          setSelectedMedia(asset ? valueForMedia(asset) : null);
        }
      } catch {
        setMutationMessage(
          'The change could not be completed. Your current form stays in place; try again shortly.',
        );
        setMutationError(true);
      } finally {
        if (restoring) {
          restoreLock.current = false;
          setIsRestoring(false);
        }
        mutationLock.current = false;
        setIsMutating(false);
      }
    });
  }

  function publish() {
    const formData = new FormData();
    formData.set('entryId', entryId);
    formData.set('expectedRevision', expectedRevision);
    runMutation(publishAction, formData);
  }

  function unpublish() {
    const formData = new FormData();
    formData.set('entryId', entryId);
    formData.set('expectedRevision', expectedRevision);
    runMutation(unpublishAction, formData);
  }

  function restore(version: number) {
    if (
      !initialEntry ||
      isDirty ||
      restoreLock.current ||
      mutationLock.current ||
      saveLock.current ||
      isMutating
    )
      return;
    restoreLock.current = true;
    const formData = new FormData();
    formData.set('entryId', entryId);
    formData.set('expectedRevision', expectedRevision);
    formData.set('version', String(version));
    runMutation(restoreAction, formData, true);
  }

  return (
    <div className={styles['editor-layout']}>
      <div className={styles['editor-main']}>
        <form
          className={styles.form}
          action={formAction}
          noValidate
          onSubmit={(event) => {
            if (saveLock.current || mutationLock.current) {
              event.preventDefault();
              return;
            }
            saveLock.current = true;
            submittedEditVersion.current = editVersion;
          }}
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="entryId" value={entryId} />
          <input type="hidden" name="expectedRevision" value={expectedRevision} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="position" value={position} />
          <input type="hidden" name="payload" value={JSON.stringify(payload)} />

          {hasIssues ? (
            <section
              id="content-form-errors"
              tabIndex={-1}
              className={actionState.status === 'conflict' ? styles.conflict : styles.validation}
              role="alert"
              aria-live="assertive"
            >
              <div>
                <strong>
                  {actionState.status === 'conflict'
                    ? 'This entry changed while you were editing.'
                    : 'Review the content fields.'}
                </strong>
                <p>{actionState.message}</p>
                {actionState.status === 'conflict' && entryId ? (
                  <button
                    className={styles['text-button']}
                    type="button"
                    onClick={() => window.location.reload()}
                  >
                    Discard these edits and load the latest saved version
                  </button>
                ) : null}
                {actionState.reauthRequired ? (
                  <Link
                    className={styles['reauth-link']}
                    href={reauthenticationHref(
                      entryId ? `/admin/editor/${entryId}` : `/admin/new/${kind}`,
                    )}
                  >
                    Sign in again with password and authenticator code
                  </Link>
                ) : null}
              </div>
              {actionState.issues?.length ? (
                <ul>
                  {actionState.issues.map((issue, index) => (
                    <li key={`${issue.path}-${index}`}>
                      <a href={`#${fieldIdForIssue(kind, issue.path)}`}>
                        {issue.path ? `${issue.path}: ` : ''}
                        {issue.message}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <fieldset
            className={styles['editor-fields']}
            disabled={isRestoring}
            aria-busy={isRestoring}
          >
            {kind === 'project' ? (
              <ProjectFields
                value={payload as ProjectPayload}
                update={updateProject}
                hasIssue={hasIssue}
                imageValue={selectedMedia}
                media={availableMedia}
                setImage={setImage}
                slugLocked={isPublished}
              />
            ) : kind === 'design' ? (
              <DesignFields
                value={payload as DesignPayload}
                update={updateDesign}
                hasIssue={hasIssue}
                imageValue={selectedMedia}
                media={availableMedia}
                setImage={setImage}
                slugLocked={isPublished}
              />
            ) : (
              <ProfileFields
                value={payload as ProfilePayload}
                update={updateProfile}
                hasIssue={hasIssue}
                icons={availableSkillIcons}
              />
            )}

            <section className={styles['order-card']} aria-labelledby="order-heading">
              <div>
                <p className={styles.eyebrow}>Portfolio order</p>
                <h2 id="order-heading">Choose where this appears.</h2>
                <p>
                  Use a smaller number for an earlier position. The portfolio sorts entries by this
                  order.
                </p>
              </div>
              <label className={styles['position-field']} htmlFor="entry-position">
                <span>Display position</span>
                <input
                  id="entry-position"
                  type="number"
                  min={1}
                  max={1_000_001}
                  value={positionInput}
                  onChange={(event) => setDisplayPosition(event.currentTarget.value)}
                  onBlur={() => {
                    if (restoreLock.current) return;
                    const parsed = Number(positionInput);
                    if (!Number.isFinite(parsed) || parsed < 1)
                      setPositionInput(String(position + 1));
                  }}
                />
                <small>Position 1 appears first.</small>
              </label>
            </section>
          </fieldset>

          <div className={styles['save-bar']}>
            <div>
              <span
                className={isDirty ? styles['dirty-dot'] : styles['saved-dot']}
                aria-hidden="true"
              />
              <strong>
                {isNew ? 'New draft' : isDirty ? 'Unsaved changes' : 'All changes saved'}
              </strong>
              {initialEntry ? <span>Current draft revision {expectedRevision}</span> : null}
            </div>
            <button
              className={styles['save-button']}
              type="submit"
              disabled={isSaving || isMutating}
            >
              {isSaving ? 'Saving draft…' : isNew ? 'Save first draft' : 'Save draft'}
            </button>
          </div>
          <p className={styles['action-message']} aria-live="polite">
            {actionState.message}
          </p>
        </form>

        {initialEntry ? (
          <RevisionHistory
            expectedRevision={expectedRevision}
            history={initialEntry.history}
            dirty={isDirty}
            onRestore={restore}
            pending={isMutating || isSaving}
          />
        ) : null}
      </div>

      <aside className={styles.workflow} aria-label="Publishing workflow">
        <div className={styles['workflow-card']}>
          <p className={styles.eyebrow}>Editorial controls</p>
          <h2>{title}</h2>
          <p className={styles.slug}>
            /
            {kind === 'project'
              ? `project/${slug}`
              : kind === 'design'
                ? `design#${slug}`
                : 'profile'}
          </p>
          <div className={styles['status-line']}>
            <span
              className={isPublished ? styles['published-mark'] : styles['draft-mark']}
              aria-hidden="true"
            />
            {isPublished ? `Published revision ${publishedRevision}` : 'Not published'}
          </div>
          <p className={styles['workflow-hint']}>
            {isDirty
              ? 'Save this form before previewing or publishing its latest changes.'
              : isNew
                ? 'Save a draft to unlock private preview and publication controls.'
                : 'Preview the saved draft before sending a revision to the public site.'}
          </p>
          <div className={styles['workflow-actions']}>
            {entryId ? (
              <Link className={styles['preview-button']} href={`/admin/preview/${entryId}`}>
                Preview saved draft <span aria-hidden="true">↗</span>
              </Link>
            ) : null}
            <button
              className={styles['publish-button']}
              type="button"
              onClick={publish}
              disabled={!canPublish || isMutating || isSaving}
            >
              {isMutating
                ? 'Working…'
                : isCurrentRevisionPublished
                  ? 'Current revision published'
                  : isPublished
                    ? 'Publish saved changes'
                    : 'Publish entry'}
            </button>
            {isPublished ? (
              <button
                className={styles['unpublish-button']}
                type="button"
                onClick={unpublish}
                disabled={!entryId || !expectedRevision || isDirty || isMutating || isSaving}
              >
                Unpublish current entry
              </button>
            ) : null}
          </div>
          {mutationMessage ? (
            <p
              className={mutationError ? styles['mutation-error'] : styles['mutation-success']}
              role={mutationError ? 'alert' : 'status'}
            >
              {mutationMessage}
            </p>
          ) : null}
          {mutationConflict ? (
            <button
              type="button"
              className={styles['text-button']}
              onClick={() => window.location.reload()}
            >
              Load the latest saved version
            </button>
          ) : null}
          {mutationReauthRequired ? (
            <Link
              className={styles['reauth-link']}
              href={reauthenticationHref(`/admin/editor/${entryId}`)}
            >
              Sign in again with password and authenticator code
            </Link>
          ) : null}
        </div>

        <div className={styles['workflow-note']}>
          <p className={styles.eyebrow}>Preview & privacy</p>
          <p>
            Drafts stay in the private CMS. A verified image remains private until a published entry
            uses it.
          </p>
          <Link href="/admin/media">Review uploaded images</Link>
        </div>
      </aside>
    </div>
  );
}

type FieldControlProps = {
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

function Field({
  id,
  label,
  hint,
  error,
  required = true,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: boolean;
  required?: boolean;
  children: ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const descriptions = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<FieldControlProps>, {
        required: required || undefined,
        'aria-invalid': error || undefined,
        'aria-describedby': descriptions || undefined,
      })
    : children;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {required ? <span className={styles['required-indicator']}>Required</span> : null}
      </label>
      {control}
      {hint ? <small id={hintId}>{hint}</small> : null}
      {error ? (
        <span id={errorId} className={styles['field-error']}>
          Check this field before saving.
        </span>
      ) : null}
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className={styles['section-heading']}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function ProjectFields({
  value,
  update,
  hasIssue,
  imageValue,
  media,
  setImage,
  slugLocked,
}: {
  value: ProjectPayload;
  update: (patch: Partial<ProjectPayload>) => void;
  hasIssue: (path: string) => boolean;
  imageValue: MediaUploadValue | null;
  media: EditorMedia[];
  setImage: (image: string, value: MediaUploadValue | null) => void;
  slugLocked: boolean;
}) {
  const study = value.study;
  return (
    <>
      <section className={styles['form-section']} aria-labelledby="project-basics-title">
        <SectionHeading
          id="project-basics-title"
          eyebrow="Project details"
          title="The essentials."
          description="Give the work a clear title, a stable address, and concise context."
        />
        <div className={styles['field-grid']}>
          <Field id="project-name" label="Project name" error={hasIssue('name')}>
            <input
              id="project-name"
              maxLength={160}
              value={value.name}
              onChange={(event) => update({ name: event.currentTarget.value })}
            />
          </Field>
          <Field
            id="project-slug"
            label="Project slug"
            hint="Lowercase letters, numbers, and hyphens. Published URLs stay fixed."
            error={hasIssue('slug')}
          >
            <input
              id="project-slug"
              maxLength={80}
              value={value.slug}
              onChange={(event) => update({ slug: event.currentTarget.value })}
              disabled={slugLocked}
            />
          </Field>
          <Field id="project-category" label="Category" error={hasIssue('category')}>
            <input
              id="project-category"
              maxLength={80}
              value={value.category}
              onChange={(event) => update({ category: event.currentTarget.value })}
            />
          </Field>
          <Field
            id="project-topics"
            label="Topics"
            required={false}
            hint="Enter one topic per line; the public portfolio displays these as tags."
            error={hasIssue('topics')}
          >
            <textarea
              id="project-topics"
              rows={4}
              value={value.topics.join('\n')}
              onChange={(event) => update({ topics: splitLines(event.currentTarget.value) })}
            />
          </Field>
        </div>
        <Field
          id="project-description"
          label="Project description"
          hint="A concise summary for the portfolio card."
          error={hasIssue('description')}
        >
          <textarea
            id="project-description"
            rows={5}
            maxLength={10000}
            value={value.description}
            onChange={(event) => update({ description: event.currentTarget.value })}
          />
        </Field>
      </section>

      <section className={styles['form-section']} aria-labelledby="project-resources-title">
        <SectionHeading
          id="project-resources-title"
          eyebrow="Links & imagery"
          title="Show the work."
          description="Choose portfolio artwork and point visitors to verified project pages."
        />
        <ImageField
          image={value.image}
          value={imageValue}
          media={media}
          setImage={setImage}
          hasIssue={hasIssue('image')}
        />
        <div className={styles['field-grid']}>
          <Field
            id="project-source"
            label="Source code URL"
            hint="HTTPS link to the project repository."
            error={hasIssue('source')}
          >
            <input
              id="project-source"
              type="url"
              inputMode="url"
              maxLength={2048}
              value={value.source}
              onChange={(event) => update({ source: event.currentTarget.value })}
            />
          </Field>
          <Field
            id="project-demo"
            label="Live demo URL"
            required={false}
            hint="Optional. Leave blank when there is no public demo."
            error={hasIssue('demo')}
          >
            <input
              id="project-demo"
              type="url"
              inputMode="url"
              maxLength={2048}
              value={value.demo ?? ''}
              onChange={(event) =>
                update({
                  demo: event.currentTarget.value.trim() ? event.currentTarget.value : null,
                })
              }
            />
          </Field>
        </div>
      </section>

      <section className={styles['form-section']} aria-labelledby="study-title">
        <div className={styles['study-toggle']}>
          <div>
            <p className={styles.eyebrow}>Case study</p>
            <h2 id="study-title">Add a deeper project study.</h2>
            <p>
              Capture focus, context, engineering decisions, and a reference for the project detail
              page.
            </p>
          </div>
          <label className={styles['switch-label']}>
            <input
              type="checkbox"
              checked={Boolean(study)}
              aria-label="Include a project study"
              onChange={(event) =>
                update({ study: event.currentTarget.checked ? emptyStudy() : undefined })
              }
            />
            <span>{study ? 'Included' : 'Optional'}</span>
          </label>
        </div>
        {study ? (
          <StudyFields
            value={study}
            update={(next) => update({ study: next })}
            hasIssue={hasIssue}
          />
        ) : null}
      </section>
    </>
  );
}

function StudyFields({
  value,
  update,
  hasIssue,
}: {
  value: ProjectStudyPayload;
  update: (value: ProjectStudyPayload) => void;
  hasIssue: (path: string) => boolean;
}) {
  function change(patch: Partial<ProjectStudyPayload>) {
    update({ ...value, ...patch });
  }
  return (
    <div className={styles['nested-fields']}>
      <div className={styles['field-grid']}>
        <Field id="study-focus" label="Study focus" error={hasIssue('study.focus')}>
          <input
            id="study-focus"
            maxLength={160}
            value={value.focus}
            onChange={(event) => change({ focus: event.currentTarget.value })}
          />
        </Field>
        <Field id="study-next" label="Next step" error={hasIssue('study.nextStep')}>
          <input
            id="study-next"
            maxLength={3000}
            value={value.nextStep}
            onChange={(event) => change({ nextStep: event.currentTarget.value })}
          />
        </Field>
      </div>
      <Field id="study-context" label="Context" error={hasIssue('study.context')}>
        <textarea
          id="study-context"
          rows={4}
          value={value.context}
          onChange={(event) => change({ context: event.currentTarget.value })}
        />
      </Field>
      <Field id="study-challenge" label="Challenge" error={hasIssue('study.challenge')}>
        <textarea
          id="study-challenge"
          rows={4}
          value={value.challenge}
          onChange={(event) => change({ challenge: event.currentTarget.value })}
        />
      </Field>
      <Field
        id="study-highlights"
        label="Highlights"
        required={false}
        hint="One highlight per line."
        error={hasIssue('study.highlights')}
      >
        <textarea
          id="study-highlights"
          rows={4}
          value={value.highlights.join('\n')}
          onChange={(event) => change({ highlights: splitLines(event.currentTarget.value) })}
        />
      </Field>
      <div className={styles['array-heading']}>
        <div>
          <h3>Engineering decisions</h3>
          <p>Describe a choice, implementation, and tradeoff.</p>
        </div>
        <button
          type="button"
          className={styles['small-button']}
          onClick={() =>
            change({
              decisions: [...value.decisions, { title: '', implementation: '', tradeoff: '' }],
            })
          }
        >
          Add decision
        </button>
      </div>
      {value.decisions.map((decision, index) => (
        <fieldset className={styles['array-card']} key={`decision-${index}`}>
          <legend>Decision {index + 1}</legend>
          <button
            type="button"
            className={styles['remove-button']}
            onClick={() =>
              change({ decisions: value.decisions.filter((_, itemIndex) => itemIndex !== index) })
            }
            aria-label={`Remove decision ${index + 1}`}
          >
            Remove
          </button>
          <Field
            id={`decision-${index}-title`}
            label="Decision title"
            error={hasIssue(`study.decisions.${index}.title`)}
          >
            <input
              id={`decision-${index}-title`}
              maxLength={180}
              value={decision.title}
              onChange={(event) =>
                changeDecision(value, index, { title: event.currentTarget.value }, update)
              }
            />
          </Field>
          <Field
            id={`decision-${index}-implementation`}
            label="Implementation"
            error={hasIssue(`study.decisions.${index}.implementation`)}
          >
            <textarea
              id={`decision-${index}-implementation`}
              rows={3}
              value={decision.implementation}
              onChange={(event) =>
                changeDecision(value, index, { implementation: event.currentTarget.value }, update)
              }
            />
          </Field>
          <Field
            id={`decision-${index}-tradeoff`}
            label="Tradeoff"
            error={hasIssue(`study.decisions.${index}.tradeoff`)}
          >
            <textarea
              id={`decision-${index}-tradeoff`}
              rows={3}
              value={decision.tradeoff}
              onChange={(event) =>
                changeDecision(value, index, { tradeoff: event.currentTarget.value }, update)
              }
            />
          </Field>
        </fieldset>
      ))}
      <div className={styles['field-grid']}>
        <Field
          id="study-reference-label"
          label="Reference label"
          error={hasIssue('study.reference.label')}
        >
          <input
            id="study-reference-label"
            maxLength={180}
            value={value.reference.label}
            onChange={(event) =>
              change({ reference: { ...value.reference, label: event.currentTarget.value } })
            }
          />
        </Field>
        <Field
          id="study-reference-href"
          label="Reference URL"
          error={hasIssue('study.reference.href')}
        >
          <input
            id="study-reference-href"
            type="url"
            inputMode="url"
            maxLength={2048}
            value={value.reference.href}
            onChange={(event) =>
              change({ reference: { ...value.reference, href: event.currentTarget.value } })
            }
          />
        </Field>
      </div>
    </div>
  );
}

function changeDecision(
  value: ProjectStudyPayload,
  index: number,
  patch: Partial<ProjectStudyPayload['decisions'][number]>,
  update: (value: ProjectStudyPayload) => void,
) {
  update({
    ...value,
    decisions: value.decisions.map((decision, itemIndex) =>
      itemIndex === index ? { ...decision, ...patch } : decision,
    ),
  });
}

function DesignFields({
  value,
  update,
  hasIssue,
  imageValue,
  media,
  setImage,
  slugLocked,
}: {
  value: DesignPayload;
  update: (patch: Partial<DesignPayload>) => void;
  hasIssue: (path: string) => boolean;
  imageValue: MediaUploadValue | null;
  media: EditorMedia[];
  setImage: (image: string, value: MediaUploadValue | null) => void;
  slugLocked: boolean;
}) {
  return (
    <>
      <section className={styles['form-section']} aria-labelledby="design-basics-title">
        <SectionHeading
          id="design-basics-title"
          eyebrow="Design details"
          title="Give the work its frame."
          description="A clear title, stable design identifier, and the destination for the complete piece."
        />
        <div className={styles['field-grid']}>
          <Field id="design-title" label="Design title" error={hasIssue('title')}>
            <input
              id="design-title"
              maxLength={240}
              value={value.title}
              onChange={(event) => update({ title: event.currentTarget.value })}
            />
          </Field>
          <Field
            id="design-id"
            label="Design ID / slug"
            hint="Used in the design archive link; use letters, numbers, hyphens, or underscores."
            error={hasIssue('id')}
          >
            <input
              id="design-id"
              maxLength={64}
              value={value.id}
              onChange={(event) => update({ id: event.currentTarget.value })}
              disabled={slugLocked}
            />
          </Field>
          <Field id="design-category" label="Platform" error={hasIssue('category')}>
            <select
              id="design-category"
              value={value.category}
              onChange={(event) => update({ category: event.currentTarget.value })}
            >
              <option value="Web">Web</option>
              <option value="Mobile">Mobile</option>
            </select>
          </Field>
          <Field
            id="design-url"
            label="Full design URL"
            hint="Use the HTTPS destination visitors should open."
            error={hasIssue('url')}
          >
            <input
              id="design-url"
              type="url"
              inputMode="url"
              maxLength={2048}
              value={value.url}
              onChange={(event) => update({ url: event.currentTarget.value })}
            />
          </Field>
        </div>
      </section>
      <section className={styles['form-section']} aria-labelledby="design-image-title">
        <SectionHeading
          id="design-image-title"
          eyebrow="Artwork"
          title="Choose the cover image."
          description="The upload stays private until this design entry is published."
        />
        <ImageField
          image={value.image}
          value={imageValue}
          media={media}
          setImage={setImage}
          hasIssue={hasIssue('image')}
        />
      </section>
    </>
  );
}

function ImageField({
  image,
  value,
  media,
  setImage,
  hasIssue,
}: {
  image: string;
  value: MediaUploadValue | null;
  media: EditorMedia[];
  setImage: (image: string, value: MediaUploadValue | null) => void;
  hasIssue: boolean;
}) {
  const currentIsKnown = media.some((asset) => asset.url === image);
  return (
    <div className={styles['image-section']}>
      <div className={styles['image-controls']}>
        <Field
          id="existing-image"
          label="Existing verified image"
          required={false}
          hint="Choose a cover image; verified assets remain private until content is published."
          error={hasIssue}
        >
          <select
            id="existing-image"
            value={image}
            onChange={(event) => {
              const selected = media.find((asset) => asset.url === event.currentTarget.value);
              setImage(event.currentTarget.value, selected ? valueForMedia(selected) : null);
            }}
          >
            <option value="">Choose an existing image</option>
            {image && !currentIsKnown ? (
              <option value={image}>Current portfolio image</option>
            ) : null}
            {media.map((asset) => (
              <option
                key={`${asset.id}:${asset.version}`}
                value={asset.url ?? ''}
                disabled={!asset.url}
              >
                {asset.alt || 'Untitled image'} · {asset.state}
              </option>
            ))}
          </select>
        </Field>
        <MediaUpload
          value={value}
          label="Upload a new image"
          onChange={(next) => setImage(next.url, next)}
        />
      </div>
      <div className={styles['image-preview']}>
        <span className={styles['image-preview-label']}>Current cover image</span>
        {value ? (
          // The authenticated endpoint is intentionally unoptimized; the private draft must not pass through Next’s image proxy.
          <Image
            src={value.previewUrl}
            unoptimized
            alt={value.alt || 'Selected image preview'}
            width={value.width}
            height={value.height}
          />
        ) : image ? (
          <Image src={image} unoptimized alt="Current portfolio image" width={960} height={640} />
        ) : (
          <div className={styles['image-empty']}>Choose or upload an image to see a preview.</div>
        )}
        {value ? (
          <p>
            {value.state === 'published'
              ? 'Already published media'
              : 'Verified · private until this entry is published'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ProfileFields({
  value,
  update,
  hasIssue,
  icons,
}: {
  value: ProfilePayload;
  update: (patch: Partial<ProfilePayload>) => void;
  hasIssue: (path: string) => boolean;
  icons: string[];
}) {
  return (
    <>
      <section className={styles['form-section']} aria-labelledby="profile-intro-title">
        <SectionHeading
          id="profile-intro-title"
          eyebrow="Profile"
          title="The introduction."
          description="The owner’s name is fixed; shape the professional summary and public links around it."
        />
        <div className={styles['field-grid']}>
          <Field
            id="profile-name"
            label="Name"
            required={false}
            hint="The full portfolio name is locked to the verified owner identity."
          >
            <input id="profile-name" value={value.name} readOnly aria-readonly="true" />
          </Field>
          <Field id="profile-title" label="Professional title" error={hasIssue('title')}>
            <input
              id="profile-title"
              maxLength={160}
              value={value.title}
              onChange={(event) => update({ title: event.currentTarget.value })}
            />
          </Field>
        </div>
        <Field id="profile-intro" label="Introduction" error={hasIssue('intro')}>
          <textarea
            id="profile-intro"
            rows={4}
            maxLength={3000}
            value={value.intro}
            onChange={(event) => update({ intro: event.currentTarget.value })}
          />
        </Field>
        <div className={styles['field-grid']}>
          <Field id="profile-linkedin" label="LinkedIn URL" error={hasIssue('linkedin')}>
            <input
              id="profile-linkedin"
              type="url"
              inputMode="url"
              value={value.linkedin}
              onChange={(event) => update({ linkedin: event.currentTarget.value })}
            />
          </Field>
          <Field id="profile-github" label="GitHub URL" error={hasIssue('github')}>
            <input
              id="profile-github"
              type="url"
              inputMode="url"
              value={value.github}
              onChange={(event) => update({ github: event.currentTarget.value })}
            />
          </Field>
          <Field id="profile-dribbble" label="Dribbble URL" error={hasIssue('dribbble')}>
            <input
              id="profile-dribbble"
              type="url"
              inputMode="url"
              value={value.dribbble}
              onChange={(event) => update({ dribbble: event.currentTarget.value })}
            />
          </Field>
          <Field id="profile-instagram" label="Instagram URL" error={hasIssue('instagram')}>
            <input
              id="profile-instagram"
              type="url"
              inputMode="url"
              value={value.instagram}
              onChange={(event) => update({ instagram: event.currentTarget.value })}
            />
          </Field>
          <Field id="profile-cv" label="CV / résumé URL" error={hasIssue('cv')}>
            <input
              id="profile-cv"
              type="url"
              inputMode="url"
              value={value.cv}
              onChange={(event) => update({ cv: event.currentTarget.value })}
            />
          </Field>
        </div>
      </section>

      <section className={styles['form-section']} aria-labelledby="experience-title">
        <div className={styles['array-heading']}>
          <SectionHeading
            id="experience-title"
            eyebrow="Experience"
            title="Work history."
            description="Each role becomes a structured item in the public experience section."
          />
          <button
            type="button"
            className={styles['small-button']}
            onClick={() =>
              update({
                experiences: [
                  ...value.experiences,
                  { company: '', role: '', start: '', end: null, description: '' },
                ],
              })
            }
          >
            Add experience
          </button>
        </div>
        {value.experiences.map((experience, index) => (
          <fieldset className={styles['array-card']} key={`experience-${index}`}>
            <legend>Experience {index + 1}</legend>
            <button
              type="button"
              className={styles['remove-button']}
              onClick={() =>
                update({
                  experiences: value.experiences.filter((_, itemIndex) => itemIndex !== index),
                })
              }
              aria-label={`Remove experience ${index + 1}`}
            >
              Remove
            </button>
            <div className={styles['field-grid']}>
              <Field
                id={`experience-${index}-company`}
                label="Company"
                error={hasIssue(`experiences.${index}.company`)}
              >
                <input
                  id={`experience-${index}-company`}
                  maxLength={180}
                  value={experience.company}
                  onChange={(event) =>
                    updateExperience(value, index, { company: event.currentTarget.value }, update)
                  }
                />
              </Field>
              <Field
                id={`experience-${index}-role`}
                label="Role"
                error={hasIssue(`experiences.${index}.role`)}
              >
                <input
                  id={`experience-${index}-role`}
                  maxLength={180}
                  value={experience.role}
                  onChange={(event) =>
                    updateExperience(value, index, { role: event.currentTarget.value }, update)
                  }
                />
              </Field>
              <Field
                id={`experience-${index}-start`}
                label="Start date"
                error={hasIssue(`experiences.${index}.start`)}
              >
                <input
                  id={`experience-${index}-start`}
                  type="month"
                  value={experience.start}
                  onChange={(event) =>
                    updateExperience(value, index, { start: event.currentTarget.value }, update)
                  }
                />
              </Field>
              <Field
                id={`experience-${index}-end`}
                label="End date"
                required={false}
                hint="Leave blank for a current role."
                error={hasIssue(`experiences.${index}.end`)}
              >
                <input
                  id={`experience-${index}-end`}
                  type="month"
                  value={experience.end ?? ''}
                  onChange={(event) =>
                    updateExperience(
                      value,
                      index,
                      { end: event.currentTarget.value || null },
                      update,
                    )
                  }
                />
              </Field>
            </div>
            <Field
              id={`experience-${index}-description`}
              label="Role summary"
              error={hasIssue(`experiences.${index}.description`)}
            >
              <textarea
                id={`experience-${index}-description`}
                rows={3}
                maxLength={4000}
                value={experience.description}
                onChange={(event) =>
                  updateExperience(value, index, { description: event.currentTarget.value }, update)
                }
              />
            </Field>
          </fieldset>
        ))}
      </section>

      <section className={styles['form-section']} aria-labelledby="education-title">
        <SectionHeading id="education-title" eyebrow="Education" title="Academic background." />
        <div className={styles['field-grid']}>
          <Field id="education-school" label="School" error={hasIssue('education.school')}>
            <input
              id="education-school"
              maxLength={180}
              value={value.education.school}
              onChange={(event) =>
                update({ education: { ...value.education, school: event.currentTarget.value } })
              }
            />
          </Field>
          <Field id="education-degree" label="Degree" error={hasIssue('education.degree')}>
            <input
              id="education-degree"
              maxLength={240}
              value={value.education.degree}
              onChange={(event) =>
                update({ education: { ...value.education, degree: event.currentTarget.value } })
              }
            />
          </Field>
          <Field id="education-years" label="Years attended" error={hasIssue('education.years')}>
            <input
              id="education-years"
              maxLength={80}
              value={value.education.years}
              onChange={(event) =>
                update({ education: { ...value.education, years: event.currentTarget.value } })
              }
            />
          </Field>
        </div>
      </section>

      <section className={styles['form-section']} aria-labelledby="skills-title">
        <div className={styles['array-heading']}>
          <SectionHeading
            id="skills-title"
            eyebrow="Skills"
            title="Tools and technologies."
            description="Skill icons come from the existing portfolio icon set."
          />
          <button
            type="button"
            className={styles['small-button']}
            onClick={() =>
              update({ skills: [...value.skills, { label: '', icon: icons[0] ?? '' }] })
            }
          >
            Add skill
          </button>
        </div>
        <div className={styles['skills-list']}>
          {value.skills.map((skill, index) => (
            <div className={styles['skill-row']} key={`skill-${index}`}>
              <Field
                id={`skill-${index}-label`}
                label={`Skill ${index + 1}`}
                error={hasIssue(`skills.${index}.label`)}
              >
                <input
                  id={`skill-${index}-label`}
                  maxLength={100}
                  value={skill.label}
                  onChange={(event) =>
                    updateSkill(value, index, { label: event.currentTarget.value }, update)
                  }
                />
              </Field>
              <Field
                id={`skill-${index}-icon`}
                label="Icon"
                error={hasIssue(`skills.${index}.icon`)}
              >
                <select
                  id={`skill-${index}-icon`}
                  value={skill.icon}
                  onChange={(event) =>
                    updateSkill(value, index, { icon: event.currentTarget.value }, update)
                  }
                >
                  {icons.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                className={styles['remove-button']}
                onClick={() =>
                  update({ skills: value.skills.filter((_, itemIndex) => itemIndex !== index) })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function updateExperience(
  value: ProfilePayload,
  index: number,
  patch: Partial<ProfilePayload['experiences'][number]>,
  update: (patch: Partial<ProfilePayload>) => void,
) {
  update({
    experiences: value.experiences.map((experience, itemIndex) =>
      itemIndex === index ? { ...experience, ...patch } : experience,
    ),
  });
}

function updateSkill(
  value: ProfilePayload,
  index: number,
  patch: Partial<ProfilePayload['skills'][number]>,
  update: (patch: Partial<ProfilePayload>) => void,
) {
  update({
    skills: value.skills.map((skill, itemIndex) =>
      itemIndex === index ? { ...skill, ...patch } : skill,
    ),
  });
}

function RevisionHistory({
  expectedRevision,
  history,
  dirty,
  onRestore,
  pending,
}: {
  expectedRevision: string;
  history: CmsRevision[];
  dirty: boolean;
  onRestore: (version: number) => void;
  pending: boolean;
}) {
  return (
    <section className={styles.history} aria-labelledby="history-heading">
      <div className={styles['section-heading']}>
        <p className={styles.eyebrow}>Version record</p>
        <h2 id="history-heading">Draft history</h2>
        <p>Each save creates an immutable revision. Restoring makes a new draft revision.</p>
      </div>
      <ol>
        {history.map((revision) => (
          <li key={revision.version}>
            <div>
              <strong>
                Revision {revision.version}
                {String(revision.version) === expectedRevision ? ' · current draft' : ''}
              </strong>
              <time dateTime={revision.createdAt}>{formatDate(revision.createdAt)}</time>
            </div>
            <button
              type="button"
              className={styles['restore-button']}
              disabled={dirty || pending || String(revision.version) === expectedRevision}
              onClick={() => onRestore(revision.version)}
            >
              Restore as draft
            </button>
          </li>
        ))}
      </ol>
      {dirty ? (
        <p className={styles['history-note']}>
          Save or discard your current form changes before restoring an older revision.
        </p>
      ) : null}
      {!history.length ? (
        <p className={styles['history-note']}>No revisions are available.</p>
      ) : null}
    </section>
  );
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
