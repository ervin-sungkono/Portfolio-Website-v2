'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  projectSchema,
  technologiesSchema,
  type ProjectDocument,
  type Technologies,
} from '@/lib/cms/schemas';
import { CmsMessage } from '../CmsEditor/CmsMessage';
import { ImagesPanel } from '../CmsEditor/ImagesPanel';
import { ProjectPanel } from '../CmsEditor/ProjectPanel';
import type { CmsSnapshot, EditorMessage, ImageUploadResult } from '../CmsEditor/type';
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

function base64Content(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const separator = result.indexOf(',');
      if (separator < 0) {
        reject(new Error('The image could not be read. Choose it again and retry.'));
        return;
      }
      resolve(result.slice(separator + 1));
    };
    reader.onerror = () =>
      reject(new Error('The image could not be read. Choose it again and retry.'));
    reader.readAsDataURL(file);
  });
}

export function GitHubImport() {
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
  const [isRetryingRefresh, setIsRetryingRefresh] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ImageUploadResult>();
  const [uploadMessage, setUploadMessage] = useState<EditorMessage>();
  const [privateAcknowledged, setPrivateAcknowledged] = useState(false);
  const [message, setMessage] = useState<EditorMessage>();
  const privateAcknowledgement = useRef<HTMLInputElement>(null);
  const snapshotRef = useRef<CmsSnapshot | null>(null);

  const selectedRepository = useMemo(
    () => repositories.find((repository) => repository.id === selectedRepositoryId) ?? null,
    [repositories, selectedRepositoryId],
  );
  const formIsDirty = form.formState.isDirty;

  function showMessage(next: EditorMessage) {
    setMessage((current) => (current?.cache === 'pending' ? current : next));
  }

  function clearMessage() {
    setMessage((current) => (current?.cache === 'pending' ? current : undefined));
  }

  const loadSnapshot = useCallback(async () => {
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
      const next = parseSnapshot(body);
      snapshotRef.current = next;
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
  }, []);

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
    void loadSnapshot();
    void loadRepositories();
  }, [loadRepositories, loadSnapshot]);

  function hasUnsubmittedDraft() {
    if (!selectedRepositoryId) {
      return false;
    }
    if (formIsDirty) {
      return true;
    }
    if (!selectedProjectSlug) {
      return true;
    }
    return false;
  }

  function chooseRepository(repositoryId: number) {
    if (repositoryId === selectedRepositoryId) {
      return;
    }
    if (
      hasUnsubmittedDraft() &&
      !window.confirm('Discard the current project draft and switch repositories?')
    ) {
      return;
    }
    const repository = repositories.find((item) => item.id === repositoryId);
    if (!repository || !snapshot) {
      return;
    }

    const mapped = snapshot.projects.filter(
      (project) => project.data.githubRepositoryId === repository.id,
    );
    setSelectedRepositoryId(repository.id);
    setPrivateAcknowledged(false);
    clearMessage();
    setUploadResult(undefined);
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

  function chooseProject(slug: string) {
    if (!snapshot || !selectedRepository) {
      return;
    }
    if (slug === selectedProjectSlug) {
      return;
    }
    if (
      (formIsDirty || !selectedProjectSlug) &&
      !window.confirm('Discard the current project draft and choose a different project?')
    ) {
      return;
    }
    clearMessage();
    setUploadResult(undefined);
    setUploadMessage(undefined);
    if (!slug) {
      setSelectedProjectSlug('');
      setNewProjectSlug(slugFromRepository(selectedRepository.name));
      form.reset(suggestionsFromRepository(selectedRepository));
      return;
    }
    const project = snapshot.projects.find((entry) => entry.slug === slug);
    if (!project) {
      showMessage({ tone: 'error', text: 'That project is no longer in the loaded snapshot.' });
      return;
    }
    if (
      project.data.githubRepositoryId !== null &&
      project.data.githubRepositoryId !== selectedRepository.id &&
      !window.confirm(
        'This project is mapped to a different GitHub repository. Replace its mapping? Project fields will be kept for review.',
      )
    ) {
      return;
    }
    const duplicate = snapshot.projects.some(
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

  async function uploadImage(file: File, slug: string, scope: 'project' | 'technology') {
    if (!selectedRepository || !snapshot || scope !== 'project') {
      return;
    }
    if (selectedRepository.private && !privateAcknowledged) {
      setUploadMessage({
        tone: 'error',
        text: 'Review and acknowledge the public repository warning before uploading an image for this private repository.',
      });
      privateAcknowledgement.current?.focus();
      return;
    }

    setIsUploading(true);
    setUploadResult(undefined);
    setUploadMessage(undefined);
    try {
      const content = await base64Content(file);
      const response = await fetch('/api/cms/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, filename: file.name, mime: file.type, content }),
      });
      const body = await readJson(response);
      const error = errorFrom(body);
      if (!response.ok || error || typeof body.path !== 'string') {
        throw new Error(
          error ||
            `The image could not be uploaded (${response.status}). Choose it again and retry.`,
        );
      }
      const result: ImageUploadResult = {
        path: body.path,
        commitUrl: typeof body.commitUrl === 'string' ? body.commitUrl : '',
        scope: 'project',
        slug,
      };
      setUploadResult(result);
      const refreshed = await loadSnapshot();
      setUploadMessage({
        tone: refreshed ? 'success' : 'error',
        text: refreshed
          ? 'Image uploaded to the public content repository. Add its path to this project, then save the project separately.'
          : 'Image uploaded, but the latest project snapshot could not be loaded. The image path is available below.',
        commitUrl: result.commitUrl || undefined,
      });
    } catch (error) {
      setUploadMessage({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'The image could not be uploaded. Choose it again and retry.',
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function saveProject(data: ProjectDocument) {
    if (message?.cache === 'pending') {
      setMessage({
        ...message,
        tone: 'error',
        text: 'The previous project commit is intact, but public refresh is still pending. Retry public refresh before saving another project.',
      });
      return;
    }
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

    setIsSaving(true);
    setMessage(undefined);
    try {
      const response = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'project',
          slug,
          expectedSha: selectedProjectSlug ? (current?.sha ?? null) : null,
          data,
        }),
      });
      const body = await readJson(response);
      const error = errorFrom(body);
      if (response.status === 409) {
        setMessage({
          tone: 'conflict',
          conflictSlug: slug,
          text:
            error || 'The project changed in GitHub after it was loaded. Your draft is still here.',
        });
        return;
      }
      if (!response.ok || error) {
        throw new Error(
          error || `The project could not be saved (${response.status}). Your draft is still here.`,
        );
      }

      setSelectedProjectSlug(slug);
      setNewProjectSlug('');
      form.reset(data);
      const cache = body.cache === 'pending' || body.cache === 'refreshed' ? body.cache : undefined;
      const writeText = selectedProjectSlug
        ? 'Project and GitHub mapping saved.'
        : 'Project created and GitHub mapping saved.';
      const refreshed = await loadSnapshot();
      const refreshText = !refreshed
        ? ' The commit succeeded, but the project list could not be refreshed. Reload before editing again.'
        : cache === 'pending'
          ? ' Public refresh is pending.'
          : cache === 'refreshed'
            ? ' Cache invalidation was accepted. Visitors may briefly see the previous version while regeneration runs.'
            : '';
      setMessage({
        tone: refreshed ? 'success' : 'error',
        text: `${writeText}${refreshText}`,
        commitUrl: typeof body.commitUrl === 'string' ? body.commitUrl : undefined,
        cache,
        ...(cache === 'pending' ? { revalidateTarget: 'project', revalidateSlug: slug } : {}),
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

  async function retryPublicRefresh() {
    const prior = message;
    if (
      !prior ||
      prior.cache !== 'pending' ||
      prior.revalidateTarget !== 'project' ||
      !prior.revalidateSlug
    ) {
      return;
    }
    setIsRetryingRefresh(true);
    try {
      const response = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'revalidate',
          target: 'project',
          slug: prior.revalidateSlug,
        }),
      });
      const body = await readJson(response);
      const error = errorFrom(body);
      if (!response.ok || error) {
        throw new Error(error || `Public refresh failed (${response.status}).`);
      }
      setMessage({
        ...prior,
        tone: 'success',
        cache: 'refreshed',
        text: 'Public refresh retry was accepted without rewriting the project. Visitors may briefly see the previous version while regeneration runs.',
      });
    } catch (error) {
      setMessage({
        ...prior,
        tone: 'error',
        text: `Public refresh failed: ${error instanceof Error ? error.message : 'try again'}. The project commit is intact; retry public refresh.`,
      });
    } finally {
      setIsRetryingRefresh(false);
    }
  }

  async function reloadConflict() {
    const next = await loadSnapshot();
    if (!next || !message?.conflictSlug) {
      return;
    }
    const latest = next.projects.find((project) => project.slug === message.conflictSlug);
    if (latest) {
      setSelectedProjectSlug(latest.slug);
      setNewProjectSlug('');
      form.reset(latest.data);
    } else {
      setSelectedProjectSlug('');
      setNewProjectSlug(selectedRepository ? slugFromRepository(selectedRepository.name) : '');
      form.reset(
        selectedRepository ? suggestionsFromRepository(selectedRepository) : emptyProject(),
      );
    }
    setMessage(undefined);
  }

  const projectFeedback = (
    <CmsMessage
      message={message}
      onReload={message?.tone === 'conflict' ? () => void reloadConflict() : undefined}
      onRetry={message?.cache === 'pending' ? () => void retryPublicRefresh() : undefined}
      pending={isSaving || isRetryingRefresh}
    />
  );

  return (
    <div
      className="cms-editor github-import"
      aria-busy={isSaving || isUploading || isRetryingRefresh || isRefreshingRepositories}
    >
      <div className="cms-editor-heading">
        <h2>Map a GitHub repository to a project</h2>
        <p>
          Choose one of the authenticated account’s accessible repositories. Its numeric GitHub ID
          is saved with the project; imported details are suggestions you can review and edit.
        </p>
        <Link className="text-link" href="/admin">
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
                  chooseRepository(Number(event.target.value));
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
              <strong>Private repository metadata will be public.</strong> Saving copies the
              repository ID and any project details you enter into{' '}
              <code>
                {snapshot?.repository.owner}/{snapshot?.repository.name}
              </code>
              , which is a public repository. This remains public even if the portfolio project is
              unpublished.
            </p>
            <label className="cms-editor-checkbox">
              <input
                ref={privateAcknowledgement}
                type="checkbox"
                checked={privateAcknowledged}
                onChange={(event) => setPrivateAcknowledged(event.target.checked)}
              />
              <span>
                I reviewed this warning and understand the repository ID and saved project metadata
                will be visible in the public content repository.
              </span>
            </label>
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
                disabled={isSaving}
              >
                Apply verified fields to blank fields
              </button>
            </div>
          )}
          {selectedRepository && (
            <ImagesPanel
              projectForm={form}
              technologiesForm={technologiesForm}
              selectedProjectSlug={selectedProjectSlug}
              newProjectSlug={newProjectSlug}
              projectOnly
              active
              pending={isUploading || isSaving}
              feedback={<CmsMessage message={uploadMessage} pending={isUploading} />}
              result={uploadResult}
              onUpload={uploadImage}
              onClearMessage={() => setUploadMessage(undefined)}
            />
          )}
          {selectedRepository && (
            <ProjectPanel
              form={form}
              snapshot={snapshot}
              active
              selectedSlug={selectedProjectSlug}
              newSlug={newProjectSlug}
              pending={isSaving || isUploading || !selectedRepository}
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
    </div>
  );
}
