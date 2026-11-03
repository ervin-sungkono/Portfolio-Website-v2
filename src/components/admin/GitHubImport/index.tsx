'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import {
  projectSchema,
  technologiesSchema,
  type ProjectDocument,
  type Technologies,
} from '@/lib/cms/schemas';
import { useConfirmDialog } from '../ConfirmDialog';
import { useCmsDraft } from '../CmsDraftProvider';
import type { CmsDraft } from '../CmsDraftProvider/type';
import { applyDraft, repositoryKey, stageProject } from '../CmsEditor/draft';
import { CmsMessage } from '../CmsEditor/CmsMessage';
import { ImagesPanel } from '../CmsEditor/ImagesPanel';
import { ProjectPanel } from '../CmsEditor/ProjectPanel';
import type { CmsSnapshot, EditorMessage } from '../CmsEditor/type';
import { errorFrom, parseSnapshot, readJson } from '../CmsEditor/response';
import type { ImportRepository } from './type';
import '../CmsEditor/style.css';
import './style.css';

type SnapshotState = 'loading' | 'ready' | 'needs-initialization' | 'error';

function emptyProject(repositoryId: number | null = null): ProjectDocument {
  return {
    schemaVersion: 2,
    githubRepositoryId: repositoryId,
    title: '',
    summary: '',
    description: '',
    published: false,
    featured: false,
    sortOrder: 0,
    year: new Date().getFullYear(),
    categories: [],
    technologies: [],
    tags: [],
    links: { demo: undefined, source: undefined },
    media: { cover: '', gallery: [] },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRepository(value: unknown): ImportRepository | null {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.id) ||
    !Number.isSafeInteger(value.ownerId) ||
    typeof value.owner !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.fullName !== 'string' ||
    typeof value.private !== 'boolean' ||
    typeof value.htmlUrl !== 'string' ||
    !(typeof value.description === 'string' || value.description === null) ||
    !(typeof value.homepage === 'string' || value.homepage === null) ||
    !Array.isArray(value.topics) ||
    value.topics.some((topic) => typeof topic !== 'string') ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    typeof value.defaultBranch !== 'string' ||
    !(typeof value.language === 'string' || value.language === null) ||
    typeof value.archived !== 'boolean' ||
    typeof value.fork !== 'boolean' ||
    typeof value.ownedByPatOwner !== 'boolean'
  ) {
    return null;
  }
  return value as ImportRepository;
}

function parseRepositories(value: unknown): ImportRepository[] {
  if (!Array.isArray(value)) {
    throw new Error('The repository list response is incomplete.');
  }
  const repositories = value.map(parseRepository);
  if (repositories.some((repository) => !repository)) {
    throw new Error('GitHub returned repository data the importer could not read.');
  }
  return repositories as ImportRepository[];
}

function slugFromRepository(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'new-project';
}

function isHttpsUrl(value: string | null): value is string {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function suggestionsFromRepository(repository: ImportRepository): ProjectDocument {
  const description = repository.description?.trim() ?? '';
  const topics = repository.topics
    .filter((topic) => topic.trim().length > 0 && topic.trim().length <= 40)
    .slice(0, 30);
  return {
    ...emptyProject(repository.id),
    title: repository.name,
    summary: description.length <= 240 ? description : '',
    description,
    tags: topics,
    links: {
      source: repository.htmlUrl,
      demo: isHttpsUrl(repository.homepage) ? repository.homepage : undefined,
    },
  };
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function withDraftNewProject(snapshot: CmsSnapshot, draft: CmsDraft) {
  if (
    !draft.newProject ||
    snapshot.projects.some((project) => project.slug === draft.newProject?.slug)
  ) {
    return snapshot;
  }
  return {
    ...snapshot,
    projects: [
      ...snapshot.projects,
      { slug: draft.newProject.slug, data: draft.newProject.data, sha: '' },
    ],
  };
}

function projectSlugIsTaken(
  snapshot: CmsSnapshot | null,
  draft: CmsDraft,
  slug: string,
  repositoryId: number,
) {
  return Boolean(
    snapshot?.projects.some((project) => project.slug === slug) ||
      draft.projects.upsert.some((project) => project.slug === slug) ||
      (draft.newProject?.slug === slug &&
        draft.newProject.data.githubRepositoryId !== repositoryId),
  );
}

function stageImportedProject(
  draft: CmsDraft,
  slug: string,
  expectedSha: string | null,
  data: ProjectDocument,
  isNewProject: boolean,
): CmsDraft {
  if (!isNewProject) {
    const next = stageProject(draft, slug, expectedSha, data);
    return draft.newProject?.slug === slug ? { ...next, newProject: undefined } : next;
  }

  const imported = { slug, data };
  if (draft.newProject && JSON.stringify(draft.newProject) === JSON.stringify(imported)) {
    return draft;
  }

  let next = draft;
  if (
    draft.newProject &&
    draft.newProject.slug !== slug &&
    draft.newProject.data.githubRepositoryId !== data.githubRepositoryId
  ) {
    next = stageProject(next, draft.newProject.slug, null, draft.newProject.data);
  }
  if (
    draft.newProject?.slug === slug &&
    draft.newProject.data.githubRepositoryId !== data.githubRepositoryId
  ) {
    return draft;
  }
  return { ...next, newProject: imported };
}

export function GitHubImport() {
  const draftStore = useCmsDraft();
  const { get: getDraft, ready: draftReady, update: updateDraft } = draftStore;
  const { confirm, confirmationDialog } = useConfirmDialog();
  const form = useForm<ProjectDocument>({
    resolver: zodResolver(projectSchema),
    defaultValues: emptyProject(),
    shouldFocusError: true,
  });
  const technologiesForm = useForm<Technologies>({
    resolver: zodResolver(technologiesSchema),
    defaultValues: {},
  });
  const [snapshot, setSnapshot] = useState<CmsSnapshot | null>(null);
  const [snapshotState, setSnapshotState] = useState<SnapshotState>('loading');
  const [snapshotError, setSnapshotError] = useState('');
  const [repositories, setRepositories] = useState<ImportRepository[]>([]);
  const [repositoryError, setRepositoryError] = useState('');
  const [repositoryStatus, setRepositoryStatus] = useState('');
  const [isRefreshingRepositories, setIsRefreshingRepositories] = useState(false);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<number | null>(null);
  const [selectedProjectSlug, setSelectedProjectSlug] = useState('');
  const [newProjectSlug, setNewProjectSlug] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<EditorMessage>();
  const [privateAcknowledged, setPrivateAcknowledged] = useState(false);
  const [message, setMessage] = useState<EditorMessage>();
  const privateAcknowledgement = useRef<HTMLInputElement>(null);
  const snapshotRef = useRef<CmsSnapshot | null>(null);
  const autoSavedProjectRef = useRef('');

  const selectedRepository = useMemo(
    () => repositories.find((repository) => repository.id === selectedRepositoryId) ?? null,
    [repositories, selectedRepositoryId],
  );
  const formIsDirty = form.formState.isDirty;
  const formValues = useWatch({ control: form.control }) as ProjectDocument;

  const persistProjectDraft = useCallback(
    async (data: ProjectDocument) => {
      if (!selectedRepositoryId) {
        return false;
      }
      const slug = selectedProjectSlug || newProjectSlug.trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return false;
      }
      const currentDraft = getDraft();
      if (
        !selectedProjectSlug &&
        projectSlugIsTaken(snapshotRef.current, currentDraft, slug, data.githubRepositoryId ?? 0)
      ) {
        return false;
      }
      const current = snapshotRef.current?.projects.find((project) => project.slug === slug);
      const expectedSha = selectedProjectSlug ? current?.sha || null : null;
      return updateDraft((draft) =>
        stageImportedProject(draft, slug, expectedSha, data, !selectedProjectSlug),
      );
    },
    [getDraft, newProjectSlug, selectedProjectSlug, selectedRepositoryId, updateDraft],
  );

  function showMessage(next: EditorMessage) {
    setMessage(next);
  }

  function clearMessage() {
    setMessage(undefined);
  }

  const loadSnapshot = useCallback(async () => {
    if (!draftReady) {
      return null;
    }
    try {
      const response = await fetch('/api/cms', { cache: 'no-store' });
      const body = await readJson(response);
      if (body.needsInitialization === true) {
        setSnapshotState('needs-initialization');
        setSnapshotError(errorFrom(body));
        return null;
      }
      const error = errorFrom(body);
      if (!response.ok || error) {
        throw new Error(error || `The content snapshot could not be loaded (${response.status}).`);
      }
      const remote = parseSnapshot(body);
      const key = repositoryKey(remote);
      const storedDraft = getDraft();
      if (storedDraft.repository && storedDraft.repository !== key) {
        throw new Error(
          'The saved browser draft belongs to a different content repository. Return to that account or discard the draft before importing.',
        );
      }
      if (
        !storedDraft.repository &&
        !(await updateDraft((current) => ({ ...current, repository: key })))
      ) {
        throw new Error('The browser could not save the draft. Check site storage and retry.');
      }
      const currentDraft = getDraft();
      const next = withDraftNewProject(applyDraft(remote, currentDraft), currentDraft);
      snapshotRef.current = remote;
      setSnapshot(next);
      setSnapshotError('');
      setSnapshotState('ready');
      return next;
    } catch (error) {
      setSnapshotState(snapshotRef.current ? 'ready' : 'error');
      setSnapshotError(
        error instanceof Error ? error.message : 'The project list could not be loaded.',
      );
      return null;
    }
  }, [draftReady, getDraft, updateDraft]);

  const loadRepositories = useCallback(async (manual = false) => {
    if (manual) {
      setIsRefreshingRepositories(true);
      setRepositoryError('');
      setRepositoryStatus('');
    }
    try {
      const response = await fetch('/api/cms/repos', { cache: 'no-store' });
      const body = await readJson(response);
      const error = errorFrom(body);
      if (!response.ok || error) {
        throw new Error(
          error || `The GitHub repository list could not be loaded (${response.status}).`,
        );
      }
      const next = parseRepositories(body.repositories);
      setRepositories(next);
      setRepositoryError('');
      if (manual) {
        setRepositoryStatus(
          `Repository metadata refreshed. Review the latest details below; the project draft was left unchanged. ${next.length} repositories are accessible.`,
        );
      }
    } catch (error) {
      setRepositoryError(
        error instanceof Error ? error.message : 'The GitHub repository list could not be loaded.',
      );
    } finally {
      if (manual) {
        setIsRefreshingRepositories(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!draftReady) {
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadSnapshot();
        void loadRepositories();
      }
    });
    return () => {
      active = false;
    };
  }, [draftReady, loadRepositories, loadSnapshot]);

  useEffect(() => {
    const slug = selectedProjectSlug || newProjectSlug.trim();
    const alreadyStaged =
      draftStore.draft.projects.upsert.some(
        (project) =>
          project.slug === slug && project.data.githubRepositoryId === selectedRepository?.id,
      ) ||
      (draftStore.draft.newProject?.slug === slug &&
        draftStore.draft.newProject.data.githubRepositoryId === selectedRepository?.id);
    const alreadyInSnapshot = snapshot?.projects.some(
      (project) =>
        project.slug === slug && project.data.githubRepositoryId === selectedRepository?.id,
    );
    if (
      !draftReady ||
      !snapshot ||
      !selectedRepository ||
      (!formIsDirty &&
        (Boolean(selectedProjectSlug) ||
          newProjectSlug.trim() === slugFromRepository(selectedRepository.name))) ||
      (selectedRepository.private && !privateAcknowledged)
    ) {
      return;
    }
    void persistProjectDraft(formValues).then((saved) => {
      if (!saved || alreadyStaged || alreadyInSnapshot) {
        return;
      }
      const key = `${selectedRepository.id}:${slug}`;
      if (autoSavedProjectRef.current !== key) {
        autoSavedProjectRef.current = key;
        setMessage({
          tone: 'success',
          text: 'Project changes are saved in this browser draft. Submit all changes in the portfolio editor to write them to GitHub.',
        });
      }
    });
  }, [
    draftReady,
    draftStore.draft,
    formIsDirty,
    formValues,
    persistProjectDraft,
    privateAcknowledged,
    selectedRepository,
    selectedProjectSlug,
    newProjectSlug,
    snapshot,
  ]);

  async function chooseRepository(repositoryId: number) {
    if (repositoryId === selectedRepositoryId) {
      return;
    }
    if (selectedRepositoryId !== null && formIsDirty) {
      const saved =
        selectedRepository?.private && !privateAcknowledged
          ? false
          : await persistProjectDraft(form.getValues());
      if (!saved && !selectedRepository?.private) {
        showMessage({
          tone: 'error',
          text: 'The current project draft could not be saved in this browser. Resolve the storage issue before switching repositories.',
        });
        return;
      }
      if (
        !(await confirm({
          title: 'Switch GitHub repository?',
          description: saved
            ? 'The current project draft is saved in this browser and will remain available in the portfolio editor. Switch to the selected repository?'
            : 'The private repository warning has not been acknowledged, so the current form changes are not in the browser draft. Switching will discard those changes. Continue?',
          confirmLabel: 'Switch repository',
        }))
      ) {
        return;
      }
    }
    const repository = repositories.find((item) => item.id === repositoryId);
    if (!repository || !snapshot) {
      return;
    }

    const currentDraft = getDraft();
    const currentSnapshot = withDraftNewProject(
      applyDraft(snapshotRef.current ?? snapshot, currentDraft),
      currentDraft,
    );
    setSnapshot(currentSnapshot);
    const mapped = currentSnapshot.projects.filter(
      (project) => project.data.githubRepositoryId === repository.id,
    );
    setSelectedRepositoryId(repository.id);
    setPrivateAcknowledged(false);
    clearMessage();
    setUploadMessage(undefined);
    if (mapped.length > 1) {
      setSelectedProjectSlug('');
      setNewProjectSlug(slugFromRepository(repository.name));
      form.reset(suggestionsFromRepository(repository));
      showMessage({
        tone: 'error',
        text: 'More than one project already uses this GitHub repository ID. Resolve the duplicate mapping in the project editor before continuing.',
      });
      return;
    }
    if (
      !mapped.length &&
      projectSlugIsTaken(
        snapshotRef.current,
        currentDraft,
        slugFromRepository(repository.name),
        repository.id,
      )
    ) {
      setSelectedProjectSlug('');
      setNewProjectSlug(slugFromRepository(repository.name));
      form.reset(suggestionsFromRepository(repository));
      showMessage({
        tone: 'error',
        text: 'A project with this URL slug already exists. Choose a different slug before staging this repository.',
      });
      return;
    }
    if (mapped[0]) {
      setSelectedProjectSlug(mapped[0].slug);
      setNewProjectSlug('');
      form.reset(mapped[0].data);
      return;
    }
    setSelectedProjectSlug('');
    setNewProjectSlug(slugFromRepository(repository.name));
    form.reset(suggestionsFromRepository(repository));
  }

  async function chooseProject(slug: string) {
    if (!snapshot || !selectedRepository) {
      return;
    }
    if (slug === selectedProjectSlug) {
      return;
    }
    if (formIsDirty) {
      const saved =
        selectedRepository.private && !privateAcknowledged
          ? false
          : await persistProjectDraft(form.getValues());
      if (!saved && !selectedRepository.private) {
        showMessage({
          tone: 'error',
          text: 'The current project draft could not be saved in this browser. Resolve the storage issue before choosing another project.',
        });
        return;
      }
      if (
        !(await confirm({
          title: 'Choose a different project?',
          description: saved
            ? 'The current project draft is saved in this browser and will remain available in the portfolio editor.'
            : 'The private repository warning has not been acknowledged, so the current form changes are not in the browser draft. Switching will discard those changes.',
          confirmLabel: 'Choose project',
        }))
      ) {
        return;
      }
    }
    clearMessage();
    setUploadMessage(undefined);
    if (!slug) {
      setSelectedProjectSlug('');
      setNewProjectSlug(slugFromRepository(selectedRepository.name));
      form.reset(suggestionsFromRepository(selectedRepository));
      return;
    }
    const currentDraft = getDraft();
    const currentSnapshot = withDraftNewProject(
      applyDraft(snapshotRef.current ?? snapshot, currentDraft),
      currentDraft,
    );
    setSnapshot(currentSnapshot);
    const project = currentSnapshot.projects.find((entry) => entry.slug === slug);
    if (!project) {
      showMessage({ tone: 'error', text: 'That project is no longer in the loaded snapshot.' });
      return;
    }
    if (
      project.data.githubRepositoryId !== null &&
      project.data.githubRepositoryId !== selectedRepository.id &&
      !(await confirm({
        title: 'Replace this project mapping?',
        description:
          'The project is mapped to another GitHub repository. Replace that mapping in the browser draft and review the project fields before submitting?',
        confirmLabel: 'Replace mapping',
      }))
    ) {
      return;
    }
    const duplicate = currentSnapshot.projects.some(
      (entry) =>
        entry.slug !== project.slug && entry.data.githubRepositoryId === selectedRepository.id,
    );
    if (duplicate) {
      showMessage({
        tone: 'error',
        text: 'Another project already maps to this GitHub repository ID.',
      });
      return;
    }
    setSelectedProjectSlug(project.slug);
    setNewProjectSlug('');
    form.reset(project.data);
    if (project.data.githubRepositoryId !== selectedRepository.id) {
      form.setValue('githubRepositoryId', selectedRepository.id, { shouldDirty: true });
    }
  }

  function applyVerifiedFields() {
    if (!selectedRepository) {
      return;
    }
    const values = form.getValues();
    const description = selectedRepository.description?.trim() ?? '';
    if (!form.getFieldState('title').isDirty && !values.title.trim()) {
      form.setValue('title', selectedRepository.name, { shouldDirty: true });
    }
    if (
      !form.getFieldState('summary').isDirty &&
      !values.summary.trim() &&
      description.length > 0 &&
      description.length <= 240
    ) {
      form.setValue('summary', description, { shouldDirty: true });
    }
    if (!form.getFieldState('description').isDirty && !values.description.trim() && description) {
      form.setValue('description', description, { shouldDirty: true });
    }
    if (!form.getFieldState('links.source').isDirty && !values.links.source) {
      form.setValue('links.source', selectedRepository.htmlUrl, { shouldDirty: true });
    }
    if (
      !form.getFieldState('links.demo').isDirty &&
      !values.links.demo &&
      isHttpsUrl(selectedRepository.homepage)
    ) {
      form.setValue('links.demo', selectedRepository.homepage, { shouldDirty: true });
    }
    if (!form.getFieldState('tags').isDirty && values.tags.length === 0) {
      form.setValue('tags', suggestionsFromRepository(selectedRepository).tags, {
        shouldDirty: true,
      });
    }
    showMessage({
      tone: 'success',
      text: 'Available verified fields were added only where the draft had no value. Review and edit them before saving.',
    });
  }

  async function uploadImage(
    file: File,
    target: { kind: 'project' | 'technology'; projectSlug?: string },
  ) {
    if (!selectedRepository || !snapshot || target.kind !== 'project') {
      throw new Error('Choose a GitHub repository before staging a project image.');
    }
    if (selectedRepository.private && !privateAcknowledged) {
      privateAcknowledgement.current?.focus();
      throw new Error(
        'Review and acknowledge the public repository warning before staging an image for this private repository.',
      );
    }

    setIsUploading(true);
    setUploadMessage(undefined);
    try {
      const slug = target.projectSlug || '';
      const result = await draftStore.stageMedia(file, target.kind, slug);
      setUploadMessage({ tone: 'success', text: 'Image saved to the browser draft.' });
      return result;
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : 'The image could not be staged. Choose it again and retry.';
      setUploadMessage({ tone: 'error', text: messageText });
      throw error;
    } finally {
      setIsUploading(false);
    }
  }

  async function saveProject(data: ProjectDocument) {
    if (!selectedRepository || !snapshot) {
      showMessage({ tone: 'error', text: 'Choose an accessible GitHub repository first.' });
      return;
    }
    if (selectedRepository.private && !privateAcknowledged) {
      showMessage({
        tone: 'error',
        text: 'Review and acknowledge the public repository warning before saving this private repository mapping.',
      });
      privateAcknowledgement.current?.focus();
      return;
    }
    if (data.githubRepositoryId !== selectedRepository.id) {
      showMessage({
        tone: 'error',
        text: 'The selected repository mapping changed. Reload the page and retry.',
      });
      return;
    }
    const duplicate = snapshot.projects.some(
      (project) =>
        project.slug !== selectedProjectSlug &&
        project.data.githubRepositoryId === selectedRepository.id,
    );
    if (duplicate) {
      showMessage({
        tone: 'error',
        text: 'Another project already maps to this GitHub repository ID. Resolve the duplicate before saving.',
      });
      return;
    }
    const slug = selectedProjectSlug || newProjectSlug.trim();
    const current = snapshot.projects.find((project) => project.slug === slug);
    if (selectedProjectSlug && !current) {
      showMessage({
        tone: 'error',
        text: 'This project is no longer in the loaded snapshot. Reload the repository version before saving.',
      });
      return;
    }
    if (
      !selectedProjectSlug &&
      projectSlugIsTaken(snapshotRef.current, getDraft(), slug, selectedRepository.id)
    ) {
      showMessage({
        tone: 'error',
        text: 'A project with this URL slug already exists. Choose a different slug before saving this repository draft.',
      });
      return;
    }

    setIsSaving(true);
    setMessage(undefined);
    try {
      if (!(await persistProjectDraft(data))) {
        throw new Error(
          draftStore.error ||
            'The project could not be saved to the browser draft. Check site storage and retry.',
        );
      }
      setSelectedProjectSlug(slug);
      setNewProjectSlug('');
      form.reset(data);
      const currentDraft = getDraft();
      const next = withDraftNewProject(
        applyDraft(snapshotRef.current ?? snapshot, currentDraft),
        currentDraft,
      );
      setSnapshot(next);
      setMessage({
        tone: 'success',
        text: 'Project saved to the browser draft. Return to the portfolio editor and submit the draft to write it to GitHub.',
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'The project could not be saved. Your draft is still here.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  const projectFeedback = <CmsMessage message={message} onDismiss={clearMessage} />;

  return (
    <div
      className="cms-editor github-import"
      aria-busy={isSaving || isUploading || isRefreshingRepositories}
    >
      <div className="cms-editor-heading">
        <h2>Map a GitHub repository to a project</h2>
        <p>
          Choose one of the authenticated account’s accessible repositories. Its numeric GitHub ID
          is saved with the project; imported details are suggestions you can review and edit.
          Changes are stored in this browser draft until you submit them in the portfolio editor.
        </p>
        <Link
          className="text-link"
          href="/admin"
          aria-disabled={isUploading || isSaving}
          onClick={(event) => {
            if (isUploading || isSaving) {
              event.preventDefault();
            }
          }}
        >
          Back to portfolio editor
        </Link>
      </div>

      <section
        className="cms-editor-panel github-import-repository"
        aria-labelledby="github-import-repository-heading"
      >
        <div className="cms-editor-panel-heading">
          <div>
            <p className="eyebrow">Repository source</p>
            <h2 id="github-import-repository-heading">Choose a repository</h2>
          </div>
          <button
            className="button button-outline"
            type="button"
            onClick={() => void loadRepositories(true)}
            disabled={isRefreshingRepositories}
          >
            {isRefreshingRepositories ? 'Refreshing…' : 'Refresh repository metadata'}
          </button>
        </div>

        <div className="github-import-repository-controls">
          <label className="cms-editor-field">
            <span>Accessible GitHub repositories</span>
            <select
              value={selectedRepository ? selectedRepository.id : ''}
              onChange={(event) => {
                if (event.target.value) {
                  void chooseRepository(Number(event.target.value));
                }
              }}
              disabled={
                snapshotState !== 'ready' || isRefreshingRepositories || !repositories.length
              }
              aria-describedby="github-import-repository-help"
            >
              <option value="">Select a repository</option>
              {repositories.map((repository) => (
                <option value={repository.id} key={repository.id}>
                  {repository.private ? 'Private · ' : 'Public · '}
                  {repository.fullName}
                  {repository.archived ? ' · archived' : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="cms-editor-hint" id="github-import-repository-help">
            Public and private repositories are listed. Refresh updates the review details and
            leaves the current project draft untouched.
          </p>
        </div>

        {snapshotState === 'loading' && <p role="status">Loading the project collection…</p>}
        {snapshotState === 'error' && (
          <div className="cms-editor-message cms-editor-message-error" role="alert">
            <p>{snapshotError}</p>
            <button
              className="cms-editor-text-button"
              type="button"
              onClick={() => void loadSnapshot()}
            >
              Retry loading projects
            </button>
          </div>
        )}
        {snapshotState === 'needs-initialization' && (
          <div className="cms-editor-state-card">
            <p className="eyebrow">Content repository setup</p>
            <p>
              {snapshotError || 'Initialize the public content repository before mapping projects.'}
            </p>
            <Link className="button" href="/admin">
              Open portfolio editor setup
            </Link>
          </div>
        )}
        {repositoryError && (
          <div className="cms-editor-message cms-editor-message-error" role="alert">
            <p>{repositoryError}</p>
          </div>
        )}
        {selectedRepositoryId !== null && !selectedRepository && (
          <p className="cms-editor-message cms-editor-message-error" role="alert">
            This repository is no longer in the accessible list. Your project draft is still here;
            refresh the list or choose another repository before saving.
          </p>
        )}
        {repositoryStatus && (
          <p className="github-import-status" role="status">
            {repositoryStatus}
          </p>
        )}

        {selectedRepository && (
          <div className="github-import-details" aria-live="polite">
            <div className="github-import-details-heading">
              <div>
                <p className="eyebrow">Latest GitHub metadata</p>
                <h3>{selectedRepository.fullName}</h3>
              </div>
              <a href={selectedRepository.htmlUrl} target="_blank" rel="noreferrer">
                View repository on GitHub
              </a>
            </div>
            <dl>
              <div>
                <dt>Repository ID</dt>
                <dd>
                  <code>{selectedRepository.id}</code>
                </dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>{selectedRepository.private ? 'Private' : 'Public'}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{selectedRepository.owner}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>
                  {selectedRepository.ownedByPatOwner
                    ? 'Owned by the configured account'
                    : 'Shared repository access'}
                </dd>
              </div>
              <div>
                <dt>Default branch</dt>
                <dd>{selectedRepository.defaultBranch}</dd>
              </div>
              {selectedRepository.language && (
                <div>
                  <dt>Primary language</dt>
                  <dd>{selectedRepository.language}</dd>
                </div>
              )}
              <div>
                <dt>Last updated</dt>
                <dd>
                  <time dateTime={selectedRepository.updatedAt}>
                    {formatUpdatedAt(selectedRepository.updatedAt)}
                  </time>
                </dd>
              </div>
            </dl>
            <p>{selectedRepository.description || 'No repository description is set.'}</p>
            {selectedRepository.homepage && isHttpsUrl(selectedRepository.homepage) && (
              <p>
                Homepage:{' '}
                <a href={selectedRepository.homepage} target="_blank" rel="noreferrer">
                  {selectedRepository.homepage}
                </a>
              </p>
            )}
            {selectedRepository.topics.length > 0 && (
              <div className="github-import-topics" aria-label="Repository topics">
                {selectedRepository.topics.map((topic) => (
                  <span key={topic}>{topic}</span>
                ))}
              </div>
            )}
            {(selectedRepository.archived || selectedRepository.fork) && (
              <p className="cms-editor-hint">
                {selectedRepository.archived ? 'This repository is archived. ' : ''}
                {selectedRepository.fork ? 'This repository is a fork.' : ''}
              </p>
            )}
          </div>
        )}

        {selectedRepository && selectedRepository.private && (
          <div className="github-import-private-warning">
            <p>
              <strong>Private repository metadata will be public.</strong> Submitting this browser
              draft copies the repository ID and any project details you enter into{' '}
              <code>
                {snapshot?.repository.owner}/{snapshot?.repository.name}
              </code>
              , which is a public repository. The information remains public even if the portfolio
              project is unpublished.
            </p>
            <label className="cms-editor-checkbox">
              <input
                ref={privateAcknowledgement}
                type="checkbox"
                checked={privateAcknowledged}
                onChange={(event) => setPrivateAcknowledged(event.target.checked)}
              />
              <span>
                I reviewed this warning and understand the repository ID and staged project metadata
                will be visible in the public content repository.
              </span>
            </label>
            <p className="cms-editor-hint">
              Acknowledge this warning to edit and save the project in your browser draft.
            </p>
          </div>
        )}
      </section>

      {snapshotState === 'ready' && snapshot && (
        <>
          {selectedRepository && (
            <div className="github-import-prefill-actions">
              <p className="cms-editor-hint">
                GitHub name, description, HTTPS homepage, source URL, and repository topics can
                prefill blank project fields. Categories, technologies, year, and images remain for
                you to choose.
              </p>
              <button
                className="button button-outline"
                type="button"
                onClick={applyVerifiedFields}
                disabled={isSaving || (selectedRepository.private && !privateAcknowledged)}
              >
                Apply verified fields to blank fields
              </button>
            </div>
          )}
          <ImagesPanel
            projectForm={form}
            technologiesForm={technologiesForm}
            selectedProjectSlug={selectedProjectSlug}
            newProjectSlug={newProjectSlug}
            projectOnly
            canUpload={Boolean(
              selectedRepository && (!selectedRepository.private || privateAcknowledged),
            )}
            active
            pending={isUploading || isSaving}
            feedback={
              <CmsMessage message={uploadMessage} onDismiss={() => setUploadMessage(undefined)} />
            }
            onUpload={uploadImage}
            onClearMessage={() => setUploadMessage(undefined)}
          />
          {selectedRepository && (
            <ProjectPanel
              form={form}
              snapshot={snapshot}
              active
              selectedSlug={selectedProjectSlug}
              newSlug={newProjectSlug}
              pending={
                isSaving ||
                isUploading ||
                !selectedRepository ||
                (selectedRepository.private && !privateAcknowledged)
              }
              feedback={projectFeedback}
              allowDelete={false}
              onSelectedSlugChange={chooseProject}
              onNewSlugChange={setNewProjectSlug}
              onSave={saveProject}
              onDelete={() => undefined}
              onClearMessage={() => setMessage(undefined)}
            />
          )}
          {!selectedRepository && (
            <p className="cms-editor-loading">
              Choose a repository above to start a new project or link an existing project.
            </p>
          )}
        </>
      )}
      {snapshotState !== 'ready' && draftStore.error && (
        <p className="cms-editor-field-error" role="alert">
          {draftStore.error}
        </p>
      )}
      {confirmationDialog}
    </div>
  );
}
