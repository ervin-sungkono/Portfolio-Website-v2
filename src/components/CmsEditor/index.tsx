'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  categoriesSchema,
  projectSchema,
  siteSchema,
  technologiesSchema,
  type Categories,
  type ProjectDocument,
  type SiteDocument,
  type Technologies,
} from '@/lib/cms/schemas';
import { CategoriesPanel } from './CategoriesPanel';
import { ImagesPanel } from './ImagesPanel';
import { ProjectPanel } from './ProjectPanel';
import { SiteProfilePanel } from './SiteProfilePanel';
import { TechnologiesPanel } from './TechnologiesPanel';
import type {
  BusySection,
  LoadState,
  CmsApiReply,
  CmsSection,
  CmsSnapshot,
  CmsWriteRequest,
  EditorMessage,
  ImageUploadResult,
} from './type';
import './style.css';

const sectionLabels: Record<CmsSection, string> = {
  projects: 'Projects',
  site: 'Site Profile',
  categories: 'Categories',
  technologies: 'Technologies',
  images: 'Images',
};

function emptyProject(): ProjectDocument {
  return {
    schemaVersion: 1,
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

function emptySite(): SiteDocument {
  return { schemaVersion: 1, siteTitle: '', headline: '', introduction: '', socialLinks: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorFrom(value: unknown) {
  if (isRecord(value)) {
    return typeof value.error === 'string' ? value.error : '';
  }
  return '';
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function parseSnapshot(value: Record<string, unknown>): CmsSnapshot {
  const repository = value.repository;
  const site = value.site;
  const categories = value.categories;
  const technologies = value.technologies;
  const projects = value.projects;

  if (
    !isRecord(repository) ||
    typeof repository.owner !== 'string' ||
    typeof repository.name !== 'string' ||
    typeof repository.defaultBranch !== 'string' ||
    !isRecord(site) ||
    typeof site.sha !== 'string' ||
    !isRecord(categories) ||
    typeof categories.sha !== 'string' ||
    !isRecord(technologies) ||
    typeof technologies.sha !== 'string' ||
    !Array.isArray(projects)
  ) {
    throw new Error('The CMS returned an incomplete content snapshot.');
  }

  return {
    repository: {
      owner: repository.owner,
      name: repository.name,
      defaultBranch: repository.defaultBranch,
    },
    site: { data: siteSchema.parse(site.data), sha: site.sha },
    categories: { data: categoriesSchema.parse(categories.data), sha: categories.sha },
    technologies: { data: technologiesSchema.parse(technologies.data), sha: technologies.sha },
    projects: projects.map((entry) => {
      if (
        !isRecord(entry) ||
        typeof entry.slug !== 'string' ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) ||
        typeof entry.sha !== 'string'
      ) {
        throw new Error('The CMS returned an invalid project entry.');
      }
      return { slug: entry.slug, data: projectSchema.parse(entry.data), sha: entry.sha };
    }),
  };
}

function cacheState(value: unknown): 'refreshed' | 'pending' | undefined {
  return value === 'refreshed' || value === 'pending' ? value : undefined;
}

function commitUrl(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
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

export function CmsEditor() {
  const projectForm = useForm<ProjectDocument>({
    resolver: zodResolver(projectSchema),
    defaultValues: emptyProject(),
    shouldFocusError: true,
  });
  const siteForm = useForm<SiteDocument>({
    resolver: zodResolver(siteSchema),
    defaultValues: emptySite(),
    shouldFocusError: true,
  });
  const categoriesForm = useForm<Categories>({
    resolver: zodResolver(categoriesSchema),
    defaultValues: {},
    shouldFocusError: true,
  });
  const technologiesForm = useForm<Technologies>({
    resolver: zodResolver(technologiesSchema),
    defaultValues: {},
    shouldFocusError: true,
  });

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [initializationMessage, setInitializationMessage] = useState('');
  const [snapshot, setSnapshot] = useState<CmsSnapshot | null>(null);
  const [activeSection, setActiveSection] = useState<CmsSection>('projects');
  const [selectedProjectSlug, setSelectedProjectSlug] = useState('');
  const [newProjectSlug, setNewProjectSlug] = useState('');
  const [busySection, setBusySection] = useState<BusySection>(null);
  const [messages, setMessages] = useState<Partial<Record<CmsSection, EditorMessage>>>({});
  const [uploadResult, setUploadResult] = useState<ImageUploadResult>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [discardVersions, setDiscardVersions] = useState<Record<CmsSection, number>>({
    projects: 0,
    site: 0,
    categories: 0,
    technologies: 0,
    images: 0,
  });

  const busyRef = useRef(false);
  const loadedSnapshotRef = useRef(false);
  const loadSnapshotRef = useRef<
    (options?: {
      discardSection?: CmsSection;
      preferredSlug?: string;
      initial?: boolean;
    }) => Promise<boolean>
  >(async () => false);

  const projectIsDirty = projectForm.formState.isDirty;
  const siteIsDirty = siteForm.formState.isDirty;
  const categoriesAreDirty = categoriesForm.formState.isDirty;
  const technologiesAreDirty = technologiesForm.formState.isDirty;
  const hasProjectDraft =
    projectIsDirty || (!selectedProjectSlug && Boolean(newProjectSlug.trim()));
  const hasUnsavedChanges =
    hasProjectDraft || siteIsDirty || categoriesAreDirty || technologiesAreDirty;
  const resetProjectForm = projectForm.reset;
  const resetSiteForm = siteForm.reset;
  const resetCategoriesForm = categoriesForm.reset;
  const resetTechnologiesForm = technologiesForm.reset;

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  const refreshSnapshot = useCallback(
    async (
      options: {
        discardSection?: CmsSection;
        preferredSlug?: string;
        initial?: boolean;
      } = {},
    ) => {
      if (options.initial) {
        setLoadState('loading');
      } else {
        setIsRefreshing(true);
      }
      setLoadError('');
      try {
        const response = await fetch('/api/cms', { cache: 'no-store' });
        const body = await readJson(response);
        if (body.needsInitialization === true) {
          setLoadState('needs-initialization');
          setInitializationMessage(errorFrom(body));
          return false;
        }
        const serverMessage = errorFrom(body);
        if (!response.ok || serverMessage) {
          throw new Error(
            serverMessage || `The content snapshot could not be loaded (${response.status}).`,
          );
        }
        const next = parseSnapshot(body);
        setLoadState('ready');
        setInitializationMessage('');

        const firstLoad = !loadedSnapshotRef.current;
        const forceSite = options.discardSection === 'site';
        const forceCategories = options.discardSection === 'categories';
        const forceTechnologies = options.discardSection === 'technologies';
        const forceProjects = options.discardSection === 'projects';
        const preserveSite = !firstLoad && !forceSite && siteIsDirty;
        const preserveCategories = !firstLoad && !forceCategories && categoriesAreDirty;
        const preserveTechnologies = !firstLoad && !forceTechnologies && technologiesAreDirty;
        const preserveProjects = !firstLoad && !forceProjects && hasProjectDraft;
        const prior = snapshot;
        let projects = next.projects;

        if (preserveProjects && selectedProjectSlug && prior) {
          const priorSelected = prior.projects.find(
            (project) => project.slug === selectedProjectSlug,
          );
          if (priorSelected) {
            const refreshedEntry = projects.some((project) => project.slug === selectedProjectSlug);
            projects = refreshedEntry
              ? projects.map((project) =>
                  project.slug === selectedProjectSlug ? priorSelected : project,
                )
              : [...projects, priorSelected];
          }
        }

        setSnapshot({
          ...next,
          site: preserveSite && prior ? prior.site : next.site,
          categories: preserveCategories && prior ? prior.categories : next.categories,
          technologies: preserveTechnologies && prior ? prior.technologies : next.technologies,
          projects,
        });

        if (firstLoad || forceSite || !siteIsDirty) {
          resetSiteForm(next.site.data);
        }
        if (firstLoad || forceCategories || !categoriesAreDirty) {
          resetCategoriesForm(next.categories.data);
        }
        if (firstLoad || forceTechnologies || !technologiesAreDirty) {
          resetTechnologiesForm(next.technologies.data);
        }
        if (firstLoad || forceProjects || !hasProjectDraft) {
          const wantedSlug = options.preferredSlug ?? selectedProjectSlug;
          const selected =
            next.projects.find((project) => project.slug === wantedSlug) || next.projects[0];
          setSelectedProjectSlug(selected?.slug || '');
          setNewProjectSlug('');
          resetProjectForm(selected?.data || emptyProject());
        }

        loadedSnapshotRef.current = true;
        return true;
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : 'The content snapshot could not be loaded. Refresh and try again.',
        );
        setLoadState(snapshot ? 'ready' : 'error');
        return false;
      } finally {
        setIsRefreshing(false);
      }
    },
    [
      categoriesAreDirty,
      hasProjectDraft,
      resetCategoriesForm,
      resetProjectForm,
      resetSiteForm,
      resetTechnologiesForm,
      selectedProjectSlug,
      siteIsDirty,
      snapshot,
      technologiesAreDirty,
    ],
  );

  useEffect(() => {
    loadSnapshotRef.current = refreshSnapshot;
  }, [refreshSnapshot]);

  useEffect(() => {
    void loadSnapshotRef.current({ initial: true });
  }, []);

  function setSectionMessage(section: CmsSection, message?: EditorMessage) {
    setMessages((current) => ({ ...current, [section]: message }));
  }

  function clearSectionMessage(section: CmsSection) {
    setMessages((current) => ({ ...current, [section]: undefined }));
  }

  async function sendMutation(
    section: CmsSection,
    request: unknown,
    conflictSlug?: string,
    retryContext?: {
      target: 'project' | 'site' | 'taxonomy';
      slug?: string;
      commitUrl?: string;
    },
  ): Promise<CmsApiReply | null> {
    if (busyRef.current) {
      return null;
    }
    busyRef.current = true;
    setBusySection(section);
    clearSectionMessage(section);
    try {
      const response = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const body = await readJson(response);
      const serverMessage = errorFrom(body);
      if (response.status === 409) {
        setSectionMessage(section, {
          tone: 'conflict',
          conflictSlug,
          text: 'This content changed after you loaded it. Your draft is still here. Reload the repository version to discard your draft and continue.',
          ...(retryContext
            ? {
                cache: 'pending' as const,
                revalidateTarget: retryContext.target,
                revalidateSlug: retryContext.slug,
                commitUrl: retryContext.commitUrl,
              }
            : {}),
        });
        return null;
      }
      if (!response.ok || serverMessage) {
        throw new Error(
          serverMessage ||
            (typeof body.message === 'string'
              ? body.message
              : `The update could not be saved (${response.status}). Your draft is still here.`),
        );
      }
      return {
        error: typeof body.error === 'string' ? body.error : undefined,
        message: typeof body.message === 'string' ? body.message : undefined,
        commitUrl: typeof body.commitUrl === 'string' ? body.commitUrl : undefined,
        sha: typeof body.sha === 'string' ? body.sha : undefined,
        cache: cacheState(body.cache),
        path: typeof body.path === 'string' ? body.path : undefined,
      };
    } catch (error) {
      setSectionMessage(section, {
        tone: 'error',
        text: retryContext
          ? `Public refresh failed: ${error instanceof Error ? error.message : 'try again'}. The content commit is intact; retry public refresh.`
          : error instanceof Error
            ? error.message
            : 'The update could not be saved. Your draft is still here.',
        ...(retryContext
          ? {
              cache: 'pending' as const,
              revalidateTarget: retryContext.target,
              revalidateSlug: retryContext.slug,
              commitUrl: retryContext.commitUrl,
            }
          : {}),
      });
      return null;
    } finally {
      busyRef.current = false;
      setBusySection(null);
    }
  }

  function reflectCommittedWrite(request: CmsWriteRequest, reply: CmsApiReply) {
    setSnapshot((current) => {
      if (!current) {
        return current;
      }
      if (request.kind === 'delete-project') {
        return {
          ...current,
          projects: current.projects.filter((project) => project.slug !== request.slug),
        };
      }
      if (!reply.sha) {
        return current;
      }
      if (request.kind === 'project') {
        const project = { slug: request.slug, data: request.data, sha: reply.sha };
        const exists = current.projects.some((entry) => entry.slug === request.slug);
        return {
          ...current,
          projects: exists
            ? current.projects.map((entry) => (entry.slug === request.slug ? project : entry))
            : [...current.projects, project],
        };
      }
      if (request.kind === 'site') {
        return { ...current, site: { data: request.data, sha: reply.sha } };
      }
      if (request.kind === 'categories') {
        return { ...current, categories: { data: request.data, sha: reply.sha } };
      }
      if (request.kind === 'technologies') {
        return { ...current, technologies: { data: request.data, sha: reply.sha } };
      }
      return current;
    });
  }

  async function finishWrite(
    section: CmsSection,
    request: CmsWriteRequest,
    reply: CmsApiReply,
    preferredSlug?: string,
  ) {
    busyRef.current = true;
    setBusySection(section);
    try {
      reflectCommittedWrite(request, reply);
      const refreshed = await refreshSnapshot({ discardSection: section, preferredSlug });
      const writeVerb =
        request.kind === 'project' && request.expectedSha === null ? 'created' : 'saved';
      const text =
        request.kind === 'delete-project'
          ? `Project “${request.slug}” was deleted.`
          : section === 'projects'
            ? `Project ${writeVerb}.`
            : section === 'site'
              ? 'Site profile saved.'
              : section === 'categories'
                ? 'Categories saved.'
                : 'Technologies saved.';
      const refreshNote = !refreshed
        ? ' The commit succeeded, but the latest repository snapshot could not be loaded; refresh before editing again.'
        : reply.cache === 'pending'
          ? ' Public refresh is pending.'
          : reply.cache === 'refreshed'
            ? ' Cache invalidation was accepted. Visitors may briefly see the previous version while regeneration runs.'
            : '';
      setSectionMessage(section, {
        tone: refreshed ? 'success' : 'error',
        text: `${text}${refreshNote}`,
        commitUrl: commitUrl(reply.commitUrl),
        cache: reply.cache,
        ...(reply.cache === 'pending'
          ? {
              revalidateTarget:
                request.kind === 'site'
                  ? 'site'
                  : request.kind === 'categories' || request.kind === 'technologies'
                    ? 'taxonomy'
                    : 'project',
              ...(request.kind === 'project' || request.kind === 'delete-project'
                ? { revalidateSlug: request.slug }
                : {}),
            }
          : {}),
      });
    } finally {
      busyRef.current = false;
      setBusySection(null);
    }
  }

  async function saveProject(data: ProjectDocument) {
    const slug = selectedProjectSlug || newProjectSlug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setSectionMessage('projects', {
        tone: 'error',
        text: 'Enter a project URL slug using lowercase letters, numbers, and single hyphens.',
      });
      return;
    }
    const current = snapshot?.projects.find((project) => project.slug === slug);
    if (selectedProjectSlug && !current) {
      setSectionMessage('projects', {
        tone: 'error',
        text: 'This project is no longer in the loaded repository snapshot. Reload before editing it.',
      });
      return;
    }
    const request: CmsWriteRequest = {
      kind: 'project',
      slug,
      expectedSha: selectedProjectSlug ? (current?.sha ?? null) : null,
      data,
    };
    const reply = await sendMutation('projects', request, slug);
    if (!reply) {
      return;
    }
    projectForm.reset(data);
    setSelectedProjectSlug(slug);
    setNewProjectSlug('');
    await finishWrite('projects', request, reply, slug);
  }

  async function saveSite(data: SiteDocument) {
    if (!snapshot) {
      return;
    }
    const request: CmsWriteRequest = { kind: 'site', expectedSha: snapshot.site.sha, data };
    const reply = await sendMutation('site', request);
    if (!reply) {
      return;
    }
    siteForm.reset(data);
    await finishWrite('site', request, reply);
  }

  async function saveCategories(data: Categories) {
    if (!snapshot) {
      return;
    }
    const request: CmsWriteRequest = {
      kind: 'categories',
      expectedSha: snapshot.categories.sha,
      data,
    };
    const reply = await sendMutation('categories', request);
    if (!reply) {
      return;
    }
    categoriesForm.reset(data);
    await finishWrite('categories', request, reply);
  }

  async function saveTechnologies(data: Technologies) {
    if (!snapshot) {
      return;
    }
    const request: CmsWriteRequest = {
      kind: 'technologies',
      expectedSha: snapshot.technologies.sha,
      data,
    };
    const reply = await sendMutation('technologies', request);
    if (!reply) {
      return;
    }
    technologiesForm.reset(data);
    await finishWrite('technologies', request, reply);
  }

  async function deleteProject() {
    const current = snapshot?.projects.find((project) => project.slug === selectedProjectSlug);
    if (!current) {
      return;
    }
    const hasDraft = projectForm.formState.isDirty;
    const detail = hasDraft ? ' Unsaved edits to this project will also be discarded.' : '';
    if (
      !window.confirm(
        `Delete “${current.data.title}” (${current.slug}) from the content repository?${detail} This cannot be undone.`,
      )
    ) {
      return;
    }
    const request: CmsWriteRequest = {
      kind: 'delete-project',
      slug: current.slug,
      expectedSha: current.sha,
    };
    const reply = await sendMutation('projects', request, current.slug);
    if (!reply) {
      return;
    }
    projectForm.reset(emptyProject());
    setSelectedProjectSlug('');
    setNewProjectSlug('');
    await finishWrite('projects', request, reply, '');
  }

  async function initializeRepository() {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusySection('initialize');
    setInitializationMessage('');
    setLoadError('');
    try {
      const response = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'initialize' }),
      });
      const body = await readJson(response);
      const serverMessage = errorFrom(body);
      if (!response.ok || serverMessage) {
        throw new Error(
          serverMessage ||
            (typeof body.message === 'string'
              ? body.message
              : `Repository initialization failed (${response.status}).`),
        );
      }
      setLoadState('loading');
      const loaded = await refreshSnapshot({ initial: true });
      if (!loaded) {
        setInitializationMessage(
          'Initialization completed, but the content snapshot could not be loaded. Refresh and try again.',
        );
      }
    } catch (error) {
      setInitializationMessage(
        error instanceof Error ? error.message : 'Repository initialization failed. Try again.',
      );
    } finally {
      busyRef.current = false;
      setBusySection(null);
    }
  }

  async function uploadImage(file: File, slug: string, scope: 'project' | 'technology') {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusySection('images');
    setUploadResult(undefined);
    clearSectionMessage('images');
    try {
      const content = await base64Content(file);
      const response = await fetch('/api/cms/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, slug, filename: file.name, mime: file.type, content }),
      });
      const body = await readJson(response);
      const serverMessage = errorFrom(body);
      if (!response.ok || serverMessage || typeof body.path !== 'string') {
        throw new Error(
          serverMessage ||
            (typeof body.message === 'string'
              ? body.message
              : `Image upload failed (${response.status}). Choose the image again and retry.`),
        );
      }
      const result: ImageUploadResult = {
        path: body.path,
        commitUrl: typeof body.commitUrl === 'string' ? body.commitUrl : '',
        scope,
        slug,
      };
      setUploadResult(result);
      const refreshed = await refreshSnapshot();
      setSectionMessage('images', {
        tone: 'success',
        text: refreshed
          ? 'Image uploaded. Add its path to a project or technology draft, then save that content separately.'
          : 'Image uploaded, but the latest content snapshot could not be loaded. The path is still available below.',
        commitUrl: commitUrl(result.commitUrl),
      });
    } catch (error) {
      setSectionMessage('images', {
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Image upload failed. Choose the image again and retry.',
      });
    } finally {
      busyRef.current = false;
      setBusySection(null);
    }
  }

  async function retryRevalidation(section: CmsSection) {
    const prior = messages[section];
    let target: 'project' | 'site' | 'taxonomy' | undefined = prior?.revalidateTarget;
    let slug = prior?.revalidateSlug;
    if (!target && section === 'projects') {
      target = 'project';
      slug = selectedProjectSlug || newProjectSlug.trim() || prior?.conflictSlug;
    } else if (!target && section === 'site') {
      target = 'site';
    } else if (!target && (section === 'categories' || section === 'technologies')) {
      target = 'taxonomy';
    }
    if (!target) {
      return;
    }
    const reply = await sendMutation(
      section,
      {
        kind: 'revalidate',
        target,
        ...(target === 'project' && slug ? { slug } : {}),
      },
      undefined,
      { target, slug, commitUrl: prior?.commitUrl },
    );
    if (reply) {
      setSectionMessage(section, {
        tone: 'success',
        text:
          reply.cache === 'pending'
            ? 'Public refresh is still pending. You can retry again.'
            : 'Public cache invalidation was accepted. Visitors may briefly see the previous version while regeneration runs.',
        commitUrl: commitUrl(reply.commitUrl) || prior?.commitUrl,
        cache: reply.cache,
        revalidateTarget: target,
        revalidateSlug: slug,
      });
    }
  }

  async function reloadConflict(section: CmsSection) {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusySection(section);
    try {
      const preferredSlug = section === 'projects' ? messages.projects?.conflictSlug : undefined;
      const refreshed = await refreshSnapshot({ discardSection: section, preferredSlug });
      if (refreshed) {
        setSectionMessage(section, undefined);
        setDiscardVersions((current) => ({ ...current, [section]: current[section] + 1 }));
      }
    } finally {
      busyRef.current = false;
      setBusySection(null);
    }
  }

  function selectProject(slug: string) {
    if (slug === selectedProjectSlug) {
      return;
    }
    const hasDraft =
      projectForm.formState.isDirty || (!selectedProjectSlug && Boolean(newProjectSlug.trim()));
    if (hasDraft && !window.confirm('Discard the unsaved project draft and switch projects?')) {
      return;
    }
    setSelectedProjectSlug(slug);
    setNewProjectSlug('');
    const next = snapshot?.projects.find((project) => project.slug === slug);
    projectForm.reset(next?.data || emptyProject());
    clearSectionMessage('projects');
  }

  async function retryLoad() {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusySection('projects');
    try {
      await refreshSnapshot({ initial: !snapshot });
    } finally {
      busyRef.current = false;
      setBusySection(null);
    }
  }

  const pending = busySection !== null;
  return (
    <section
      className="cms-editor"
      aria-labelledby="cms-editor-heading"
      aria-busy={pending || isRefreshing}
    >
      <header className="cms-editor-heading">
        <p className="eyebrow">Owner workspace</p>
        <h2 id="cms-editor-heading">Content editor</h2>
        {snapshot && (
          <p>
            Editing{' '}
            <strong>
              {snapshot.repository.owner}/{snapshot.repository.name}
            </strong>{' '}
            on <code>{snapshot.repository.defaultBranch}</code>.
          </p>
        )}
      </header>

      {loadState === 'loading' && !snapshot && (
        <p className="cms-editor-loading" role="status">
          Loading CMS content…
        </p>
      )}

      {loadState === 'error' && !snapshot && (
        <section className="cms-editor-state-card" aria-labelledby="cms-load-error-heading">
          <h3 id="cms-load-error-heading">CMS content could not be loaded</h3>
          <p role="alert">{loadError || 'Refresh the content snapshot and try again.'}</p>
          <button
            type="button"
            className="button"
            onClick={() => void retryLoad()}
            disabled={pending}
          >
            Retry loading
          </button>
        </section>
      )}

      {loadState === 'needs-initialization' && (
        <section className="cms-editor-state-card" aria-labelledby="cms-initialize-heading">
          <p className="eyebrow">Content repository setup</p>
          <h3 id="cms-initialize-heading">Initialize the CMS content repository</h3>
          <p>
            Initialization creates the starter site profile and taxonomy files only when the
            configured repository is empty. Existing or incompatible content must be reviewed before
            it can be used.
          </p>
          {initializationMessage && (
            <p className="cms-editor-field-error" role="alert">
              {initializationMessage}
            </p>
          )}
          <button
            type="button"
            className="button"
            onClick={() => void initializeRepository()}
            disabled={pending}
          >
            {pending ? 'Initializing…' : 'Initialize content repository'}
          </button>
        </section>
      )}

      {loadState === 'ready' && snapshot && (
        <>
          {loadError && (
            <div className="cms-editor-message cms-editor-message-error" role="alert">
              <p>{loadError}</p>
              <button
                type="button"
                className="cms-editor-text-button"
                onClick={() => void retryLoad()}
                disabled={pending}
              >
                Reload repository snapshot
              </button>
            </div>
          )}
          <nav className="cms-editor-navigation" aria-label="CMS editor sections">
            {(Object.keys(sectionLabels) as CmsSection[]).map((section) => (
              <button
                key={section}
                type="button"
                className="cms-editor-nav-button"
                aria-pressed={activeSection === section}
                aria-controls={`cms-editor-${section}-panel`}
                onClick={() => setActiveSection(section)}
              >
                {sectionLabels[section]}
              </button>
            ))}
          </nav>
          {isRefreshing && (
            <p className="cms-editor-refreshing" role="status">
              Refreshing repository snapshot…
            </p>
          )}
          <ProjectPanel
            key={`projects:${discardVersions.projects}`}
            form={projectForm}
            snapshot={snapshot}
            active={activeSection === 'projects'}
            selectedSlug={selectedProjectSlug}
            newSlug={newProjectSlug}
            pending={pending}
            message={messages.projects}
            onSelectedSlugChange={selectProject}
            onNewSlugChange={(slug) => {
              setNewProjectSlug(slug);
              clearSectionMessage('projects');
            }}
            onSave={saveProject}
            onDelete={() => void deleteProject()}
            onClearMessage={() => clearSectionMessage('projects')}
            onReload={() => void reloadConflict('projects')}
            onRetry={() => void retryRevalidation('projects')}
          />
          <SiteProfilePanel
            key={`site:${discardVersions.site}`}
            form={siteForm}
            active={activeSection === 'site'}
            pending={pending}
            message={messages.site}
            onSave={saveSite}
            onClearMessage={() => clearSectionMessage('site')}
            onReload={() => void reloadConflict('site')}
            onRetry={() => void retryRevalidation('site')}
          />
          <CategoriesPanel
            key={`categories:${discardVersions.categories}`}
            form={categoriesForm}
            active={activeSection === 'categories'}
            pending={pending}
            message={messages.categories}
            onSave={saveCategories}
            onClearMessage={() => clearSectionMessage('categories')}
            onReload={() => void reloadConflict('categories')}
            onRetry={() => void retryRevalidation('categories')}
          />
          <TechnologiesPanel
            key={`technologies:${discardVersions.technologies}`}
            form={technologiesForm}
            active={activeSection === 'technologies'}
            pending={pending}
            message={messages.technologies}
            onSave={saveTechnologies}
            onClearMessage={() => clearSectionMessage('technologies')}
            onReload={() => void reloadConflict('technologies')}
            onRetry={() => void retryRevalidation('technologies')}
          />
          <ImagesPanel
            key={`images:${discardVersions.images}`}
            projectForm={projectForm}
            technologiesForm={technologiesForm}
            selectedProjectSlug={selectedProjectSlug}
            newProjectSlug={newProjectSlug}
            active={activeSection === 'images'}
            pending={pending}
            message={messages.images}
            result={uploadResult}
            onUpload={uploadImage}
            onClearMessage={() => clearSectionMessage('images')}
            onReload={() => void reloadConflict('images')}
            onRetry={() => void retryRevalidation('images')}
          />
        </>
      )}
    </section>
  );
}
