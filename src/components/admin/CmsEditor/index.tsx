'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/common/Button';
import {
  categoriesSchema,
  projectSchema,
  postSchema,
  siteSchema,
  technologiesSchema,
  finalizeCmsDraftSchema,
  type Categories,
  type CmsSnapshot,
  type ProjectDocument,
  type PostDocument,
  type SiteDocument,
  type Technologies,
} from '@/lib/cms/schemas';
import { CategoriesPanel } from './CategoriesPanel';
import { useConfirmDialog } from '../ConfirmDialog';
import { useCmsDraft } from '../CmsDraftProvider';
import { emptyDraft, type CmsDraft } from '../CmsDraftProvider/type';
import { CmsMessage } from './CmsMessage';
import { DesignsPanel } from './DesignsPanel';
import { ImagesPanel } from './ImagesPanel';
import { ProjectPanel } from './ProjectPanel';
import { PostsPanel } from './PostsPanel';
import { PublishSummary } from './PublishSummary';
import { SiteProfilePanel } from './SiteProfilePanel';
import { TechnologiesPanel } from './TechnologiesPanel';
import type { BusySection, LoadState, CmsSection, EditorMessage } from './type';
import { errorFrom, parseSnapshot, readJson } from './response';
import { safeCommitUrl } from './utils';
import {
  applyDraft,
  bindDraftRepository,
  emptyProject,
  hasDraftChanges,
  repositoryKey,
  stageProject,
  synchronizeDocument,
  synchronizeProject,
  synchronizePost,
} from './draft';
import { loadConflictReview, rebaseReviewedVersions, type ConflictReview } from './conflicts';
import { summarizePublishDraft } from './publish-summary';
import { useCmsDraftAutosave } from './useCmsDraftAutosave';
import './style.css';

const sectionLabels: Record<CmsSection, string> = {
  projects: 'Projects',
  posts: 'Blog Posts',
  site: 'Site Profile',
  categories: 'Categories',
  technologies: 'Technologies',
  designs: 'Designs',
  images: 'Images',
};

function emptySite(): SiteDocument {
  return { schemaVersion: 1, siteTitle: '', headline: '', introduction: '', socialLinks: [] };
}

function emptyPost(): PostDocument {
  return {
    schemaVersion: 1,
    title: '',
    summary: '',
    body: '',
    published: false,
    publishedAt: new Date().toISOString().slice(0, 10),
  };
}

export function CmsEditor() {
  const draftStore = useCmsDraft();
  const { draft, ready: draftReady, get: getDraft, update: updateDraft } = draftStore;
  const { confirm, confirmationDialog } = useConfirmDialog();
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
  const postForm = useForm<PostDocument>({
    resolver: zodResolver(postSchema),
    defaultValues: emptyPost(),
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
  const [headerActions, setHeaderActions] = useState<HTMLElement | null>(null);
  const [loadError, setLoadError] = useState('');
  const [initializationMessage, setInitializationMessage] = useState('');
  const [snapshot, setSnapshot] = useState<CmsSnapshot | null>(null);
  const [activeSection, setActiveSection] = useState<CmsSection>('projects');
  const [selectedProjectSlug, setSelectedProjectSlug] = useState('');
  const [newProjectSlug, setNewProjectSlug] = useState('');
  const [selectedPostSlug, setSelectedPostSlug] = useState('');
  const [newPostSlug, setNewPostSlug] = useState('');
  const [busySection, setBusySection] = useState<BusySection>(null);
  const [messages, setMessages] = useState<Partial<Record<CmsSection, EditorMessage>>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [finalMessage, setFinalMessage] = useState<EditorMessage>();
  const [conflicts, setConflicts] = useState<ConflictReview[]>([]);
  const [discardVersions, setDiscardVersions] = useState<Record<CmsSection, number>>({
    projects: 0,
    posts: 0,
    site: 0,
    categories: 0,
    technologies: 0,
    designs: 0,
    images: 0,
  });

  const busyRef = useRef(false);
  const loadedSnapshotRef = useRef(false);
  const remoteSnapshotRef = useRef<CmsSnapshot | null>(null);
  const loadSnapshotRef = useRef<
    (options?: {
      discardSection?: CmsSection;
      preferredSlug?: string;
      initial?: boolean;
    }) => Promise<boolean>
  >(async () => false);

  const projectIsDirty = projectForm.formState.isDirty;
  const postIsDirty = postForm.formState.isDirty;
  const postValues = useWatch({ control: postForm.control }) as PostDocument;
  const hasPostDraft = postIsDirty || (!selectedPostSlug && Boolean(newPostSlug.trim()));
  const siteIsDirty = siteForm.formState.isDirty;
  const categoriesAreDirty = categoriesForm.formState.isDirty;
  const technologiesAreDirty = technologiesForm.formState.isDirty;
  const projectValues = useWatch({ control: projectForm.control }) as ProjectDocument;
  const siteValues = useWatch({ control: siteForm.control }) as SiteDocument;
  const categoryValues = useWatch({ control: categoriesForm.control }) as Categories;
  const technologyValues = useWatch({ control: technologiesForm.control }) as Technologies;
  const hasProjectDraft =
    projectIsDirty || (!selectedProjectSlug && Boolean(newProjectSlug.trim()));
  const hasUnsavedChanges =
    hasPostDraft ||
    hasProjectDraft ||
    siteIsDirty ||
    categoriesAreDirty ||
    technologiesAreDirty ||
    hasDraftChanges(draft);
  const resetProjectForm = projectForm.reset;
  const resetPostForm = postForm.reset;
  const resetSiteForm = siteForm.reset;
  const resetCategoriesForm = categoriesForm.reset;
  const resetTechnologiesForm = technologiesForm.reset;

  useCmsDraftAutosave({
    snapshot,
    remoteSnapshotRef,
    draftReady,
    busyRef,
    updateDraft,
    selectedProjectSlug,
    newProjectSlug,
    projectIsDirty,
    projectValues,
    selectedPostSlug,
    newPostSlug,
    postIsDirty,
    postValues,
    siteIsDirty,
    siteValues,
    categoriesAreDirty,
    categoryValues,
    technologiesAreDirty,
    technologyValues,
  });

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
        const remote = parseSnapshot(body);
        remoteSnapshotRef.current = remote;
        const key = repositoryKey(remote);
        const stored = getDraft();
        const bound = bindDraftRepository(stored, key);
        if (!bound) {
          throw new Error(
            'The saved browser draft belongs to a different content repository. Return to that account or discard the draft.',
          );
        }
        if (
          bound !== stored &&
          !(await updateDraft((value) => bindDraftRepository(value, key) ?? value))
        ) {
          throw new Error('The browser could not save the draft. Check site storage and retry.');
        }
        if (getDraft().repository !== key) {
          throw new Error('The saved browser draft belongs to a different content repository.');
        }
        const next = applyDraft(remote, getDraft());
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
          const newDraft = firstLoad ? getDraft().newProject : undefined;
          const wantedSlug = options.preferredSlug ?? selectedProjectSlug;
          const selected =
            next.projects.find((project) => project.slug === wantedSlug) || next.projects[0];
          setSelectedProjectSlug(newDraft ? '' : selected?.slug || '');
          setNewProjectSlug(newDraft?.slug || '');
          resetProjectForm(newDraft?.data || selected?.data || emptyProject());
        }
        if (firstLoad || options.discardSection === 'posts' || !hasPostDraft) {
          const newDraft = firstLoad ? getDraft().newPost : undefined;
          const selected =
            next.posts.find((post) => post.slug === selectedPostSlug) || next.posts[0];
          setSelectedPostSlug(newDraft ? '' : selected?.slug || '');
          setNewPostSlug(newDraft?.slug || '');
          resetPostForm(newDraft?.data || selected?.data || emptyPost());
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
      hasPostDraft,
      resetCategoriesForm,
      resetProjectForm,
      resetPostForm,
      resetSiteForm,
      resetTechnologiesForm,
      selectedProjectSlug,
      selectedPostSlug,
      siteIsDirty,
      snapshot,
      technologiesAreDirty,
      getDraft,
      updateDraft,
    ],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setHeaderActions(document.getElementById('cms-header-actions'));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadSnapshotRef.current = refreshSnapshot;
  }, [refreshSnapshot]);

  useEffect(() => {
    if (draftReady) {
      void loadSnapshotRef.current({ initial: true });
    }
  }, [draftReady]);

  function setSectionMessage(section: CmsSection, message?: EditorMessage) {
    if (message) {
      setFinalMessage(undefined);
    }
    setMessages((current) => ({ ...current, [section]: message }));
  }

  function clearSectionMessage(section: CmsSection) {
    setMessages((current) => ({ ...current, [section]: undefined }));
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
    if (!selectedProjectSlug && current) {
      setSectionMessage('projects', {
        tone: 'error',
        text: 'A project with this URL slug already exists. Choose another slug.',
      });
      return;
    }
    if (selectedProjectSlug && !current) {
      setSectionMessage('projects', {
        tone: 'error',
        text: 'This project is no longer in the loaded repository snapshot. Reload before editing it.',
      });
      return;
    }
    const baseline = remoteSnapshotRef.current?.projects.find((project) => project.slug === slug);
    const saved = await updateDraft((value) => ({
      ...synchronizeProject(value, slug, baseline, data),
      newProject: undefined,
    }));
    if (!saved) {
      return;
    }
    setSnapshot((value) => value && applyDraft(remoteSnapshotRef.current ?? value, getDraft()));
    projectForm.reset(data);
    setSelectedProjectSlug(slug);
    setNewProjectSlug('');
    setSectionMessage('projects', { tone: 'success', text: 'Project saved to the browser draft.' });
  }

  async function savePost(data: PostDocument) {
    const slug = selectedPostSlug || newPostSlug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
      setSectionMessage('posts', { tone: 'error', text: 'Enter a valid blog post URL slug.' });
      return;
    }
    if (!selectedPostSlug && snapshot?.posts.some((post) => post.slug === slug)) {
      setSectionMessage('posts', {
        tone: 'error',
        text: 'A blog post with this URL slug already exists.',
      });
      return;
    }
    const baseline = remoteSnapshotRef.current?.posts.find((post) => post.slug === slug);
    if (
      !(await updateDraft((value) => ({
        ...synchronizePost(value, slug, baseline, data),
        newPost: undefined,
      })))
    ) {
      return;
    }
    setSnapshot((value) => value && applyDraft(remoteSnapshotRef.current ?? value, getDraft()));
    postForm.reset(data);
    setSelectedPostSlug(slug);
    setNewPostSlug('');
    setSectionMessage('posts', { tone: 'success', text: 'Blog post saved to the browser draft.' });
  }

  async function deletePost(slug: string): Promise<boolean> {
    const current = snapshot?.posts.find((post) => post.slug === slug);
    if (
      !current ||
      !(await confirm({
        title: 'Remove this blog post?',
        description: `Deletion of ${current.data.title} will be staged until you submit the draft.`,
        confirmLabel: 'Remove post',
        danger: true,
      }))
    ) {
      return false;
    }
    if (
      !(await updateDraft((value) => {
        const posts = value.posts ?? { upsert: [], delete: [] };
        const staged = posts.upsert.find((post) => post.slug === slug);
        const expectedSha = staged ? staged.expectedSha : current.sha || null;
        return {
          ...value,
          newPost: value.newPost?.slug === slug ? undefined : value.newPost,
          posts: {
            upsert: posts.upsert.filter((post) => post.slug !== slug),
            delete: [
              ...posts.delete.filter((post) => post.slug !== slug),
              ...(expectedSha ? [{ slug, expectedSha }] : []),
            ],
          },
        };
      }))
    ) {
      return false;
    }
    setSnapshot((value) => value && applyDraft(remoteSnapshotRef.current ?? value, getDraft()));
    if (selectedPostSlug === slug) {
      setSelectedPostSlug('');
      setNewPostSlug('');
      postForm.reset(emptyPost());
    }
    setSectionMessage('posts', {
      tone: 'success',
      text: 'Blog post removal saved to the browser draft.',
    });
    return true;
  }

  async function selectPost(slug: string): Promise<boolean> {
    if (slug === selectedPostSlug) {
      return true;
    }
    if (selectedPostSlug || postIsDirty || newPostSlug.trim()) {
      const data = postForm.getValues();
      const baseline = remoteSnapshotRef.current?.posts.find(
        (post) => post.slug === selectedPostSlug,
      );
      const saved = await updateDraft((value) =>
        selectedPostSlug
          ? synchronizePost(value, selectedPostSlug, baseline, data)
          : { ...value, newPost: { slug: newPostSlug, data } },
      );
      if (!saved) {
        setSectionMessage('posts', {
          tone: 'error',
          text: 'Save the browser draft before switching posts.',
        });
        return false;
      }
    }
    const view = snapshot && applyDraft(remoteSnapshotRef.current ?? snapshot, getDraft());
    const selected = view?.posts.find((post) => post.slug === slug);
    if (slug && !selected) {
      return false;
    }
    const newPost = !slug ? getDraft().newPost : undefined;
    setSelectedPostSlug(slug);
    setNewPostSlug(newPost?.slug || '');
    postForm.reset(newPost?.data || selected?.data || emptyPost());
    clearSectionMessage('posts');
    return true;
  }

  async function saveSite(data: SiteDocument) {
    if (!snapshot) {
      return;
    }
    if (
      !(await updateDraft((value) =>
        synchronizeDocument(value, 'site', remoteSnapshotRef.current?.site ?? snapshot.site, data),
      ))
    ) {
      return;
    }
    siteForm.reset(data);
    setSnapshot((value) => value && applyDraft(remoteSnapshotRef.current ?? value, getDraft()));
    setSectionMessage('site', {
      tone: 'success',
      text: 'Site profile saved to the browser draft.',
    });
  }

  async function saveCategories(data: Categories) {
    if (!snapshot) {
      return;
    }
    if (
      !(await updateDraft((value) =>
        synchronizeDocument(
          value,
          'categories',
          remoteSnapshotRef.current?.categories ?? snapshot.categories,
          data,
        ),
      ))
    ) {
      return;
    }
    categoriesForm.reset(data);
    setSnapshot((value) => value && applyDraft(remoteSnapshotRef.current ?? value, getDraft()));
    setSectionMessage('categories', {
      tone: 'success',
      text: 'Categories saved to the browser draft.',
    });
  }

  async function saveTechnologies(data: Technologies) {
    if (!snapshot) {
      return;
    }
    if (
      !(await updateDraft((value) =>
        synchronizeDocument(
          value,
          'technologies',
          remoteSnapshotRef.current?.technologies ?? snapshot.technologies,
          data,
        ),
      ))
    ) {
      return;
    }
    technologiesForm.reset(data);
    setSnapshot((value) => value && applyDraft(remoteSnapshotRef.current ?? value, getDraft()));
    setSectionMessage('technologies', {
      tone: 'success',
      text: 'Technologies saved to the browser draft.',
    });
  }

  async function deleteProject() {
    const current = snapshot?.projects.find((project) => project.slug === selectedProjectSlug);
    if (!current) {
      return false;
    }
    if (
      !(await confirm({
        title: 'Remove this project?',
        description: `“${current.data.title}” will be removed when you submit the draft.`,
        confirmLabel: 'Remove project',
        danger: true,
      }))
    ) {
      return false;
    }
    const saved = await updateDraft((value) => {
      const staged = value.projects.upsert.find((project) => project.slug === current.slug);
      const expectedSha = staged ? staged.expectedSha : current.sha || null;
      return {
        ...value,
        projects: {
          upsert: value.projects.upsert.filter((project) => project.slug !== current.slug),
          delete: expectedSha
            ? [
                ...value.projects.delete.filter((project) => project.slug !== current.slug),
                { slug: current.slug, expectedSha },
              ]
            : value.projects.delete,
        },
      };
    });
    if (!saved) {
      return false;
    }
    setSnapshot(
      (value) =>
        value && {
          ...value,
          projects: value.projects.filter((project) => project.slug !== current.slug),
        },
    );
    projectForm.reset(emptyProject());
    setSelectedProjectSlug('');
    setNewProjectSlug('');
    setSectionMessage('projects', {
      tone: 'success',
      text: 'Project removal saved to the browser draft.',
    });
    return true;
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

  async function uploadImage(
    file: File,
    target: { kind: 'project' | 'technology'; projectSlug?: string },
  ) {
    if (busyRef.current) {
      throw new Error('Wait for the current image to finish.');
    }
    busyRef.current = true;
    setBusySection('images');
    clearSectionMessage('images');
    try {
      const slug = target.kind === 'technology' ? 'technologies' : target.projectSlug || '';
      const result = await draftStore.stageMedia(file, target.kind, slug);
      setSectionMessage('images', { tone: 'success', text: 'Image saved to the browser draft.' });
      return result;
    } catch (error) {
      setSectionMessage('images', {
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Image upload failed. Choose the image again and retry.',
      });
      throw error;
    } finally {
      busyRef.current = false;
      setBusySection(null);
    }
  }

  async function prepareDraft(): Promise<CmsDraft> {
    const baseline = remoteSnapshotRef.current;
    if (!snapshot || !baseline) {
      throw new Error('Load the repository before submitting.');
    }
    let next = getDraft();
    if (selectedPostSlug) {
      next = synchronizePost(
        next,
        selectedPostSlug,
        baseline.posts.find((post) => post.slug === selectedPostSlug),
        postForm.getValues(),
      );
    } else if (postForm.formState.isDirty || newPostSlug.trim()) {
      next = { ...next, newPost: { slug: newPostSlug, data: postForm.getValues() } };
    }
    if (selectedProjectSlug) {
      next = synchronizeProject(
        next,
        selectedProjectSlug,
        baseline.projects.find((project) => project.slug === selectedProjectSlug),
        projectForm.getValues(),
      );
    } else if (projectForm.formState.isDirty || newProjectSlug.trim()) {
      next = { ...next, newProject: { slug: newProjectSlug, data: projectForm.getValues() } };
    }
    next = synchronizeDocument(next, 'site', baseline.site, siteForm.getValues());
    next = synchronizeDocument(next, 'categories', baseline.categories, categoriesForm.getValues());
    next = synchronizeDocument(
      next,
      'technologies',
      baseline.technologies,
      technologiesForm.getValues(),
    );
    let promotedSlug: string | undefined;
    let promotedPostSlug: string | undefined;
    if (next.newPost) {
      const slug = next.newPost.slug.trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
        setActiveSection('posts');
        throw new Error('Enter a valid blog post URL slug before submitting.');
      }
      if (snapshot.posts.some((post) => post.slug === slug)) {
        throw new Error('A blog post with this URL slug already exists.');
      }
      next = {
        ...synchronizePost(
          next,
          slug,
          baseline.posts.find((post) => post.slug === slug),
          next.newPost.data,
        ),
        newPost: undefined,
      };
      promotedPostSlug = slug;
    }
    if (next.newProject) {
      const slug = next.newProject.slug.trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('Enter a valid URL slug for the new project before submitting.');
      }
      if (snapshot.projects.some((project) => project.slug === slug)) {
        throw new Error(
          `A project with the URL slug “${slug}” already exists. Choose another slug.`,
        );
      }
      next = { ...stageProject(next, slug, null, next.newProject.data), newProject: undefined };
      promotedSlug = slug;
    }
    if (!hasDraftChanges(next)) {
      if (!(await updateDraft(() => next))) {
        throw new Error('The draft could not be saved in this browser. Free storage and retry.');
      }
      setSnapshot(applyDraft(baseline, next));
      if (promotedPostSlug) {
        const restored = baseline.posts.find((post) => post.slug === promotedPostSlug);
        setSelectedPostSlug(promotedPostSlug);
        setNewPostSlug('');
        postForm.reset(restored?.data || emptyPost());
      }
      throw new Error('There are no changes to submit.');
    }
    const candidate = {
      kind: 'finalize',
      repositoryKey: next.repository,
      projects: next.projects,
      ...(next.posts && { posts: next.posts }),
      ...(next.site && { site: next.site }),
      ...(next.categories && { categories: next.categories }),
      ...(next.technologies && { technologies: next.technologies }),
      ...(next.designs && { designs: next.designs }),
      ...(next.deleteMedia?.length && { deleteMedia: next.deleteMedia }),
      media: next.media.map((item) => ({ ...item, blobSha: '0'.repeat(40) })),
    };
    const validation = finalizeCmsDraftSchema.safeParse(candidate);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      const section = issue.path[0];
      let label = 'draft';
      if (
        section === 'projects' &&
        issue.path[1] === 'upsert' &&
        typeof issue.path[2] === 'number'
      ) {
        const invalid = next.projects.upsert[issue.path[2]];
        if (invalid) {
          const newProject = getDraft().newProject;
          const editingNew = newProject?.slug.trim() === invalid.slug;
          setSelectedProjectSlug(editingNew ? '' : invalid.slug);
          setNewProjectSlug(editingNew ? invalid.slug : '');
          projectForm.reset(invalid.data);
          setActiveSection('projects');
          requestAnimationFrame(() => void projectForm.trigger(undefined, { shouldFocus: true }));
          label = `project “${invalid.data.title || invalid.slug}”`;
        }
      } else if (section === 'posts') {
        const invalid =
          typeof issue.path[2] === 'number' ? next.posts?.upsert[issue.path[2]] : undefined;
        if (invalid) {
          const isNew = getDraft().newPost?.slug.trim() === invalid.slug;
          setSelectedPostSlug(isNew ? '' : invalid.slug);
          setNewPostSlug(isNew ? invalid.slug : '');
          postForm.reset(invalid.data);
        }
        setActiveSection('posts');
        requestAnimationFrame(() => void postForm.trigger(undefined, { shouldFocus: true }));
        label = 'blog post';
      } else if (section === 'site') {
        setActiveSection('site');
        requestAnimationFrame(() => void siteForm.trigger(undefined, { shouldFocus: true }));
        label = 'site profile';
      } else if (section === 'categories') {
        setActiveSection('categories');
        requestAnimationFrame(() => void categoriesForm.trigger(undefined, { shouldFocus: true }));
        label = 'categories';
      } else if (section === 'technologies') {
        setActiveSection('technologies');
        requestAnimationFrame(
          () => void technologiesForm.trigger(undefined, { shouldFocus: true }),
        );
        label = 'technologies';
      } else if (section === 'designs') {
        setActiveSection('designs');
        label = 'design selection';
      }
      throw new Error(`Check the ${label}: ${issue.message}`);
    }
    const view = applyDraft(baseline, next);
    const referencedImages = new Set([
      ...view.projects.flatMap(({ data }) => [data.media.cover, ...data.media.gallery]),
      ...Object.values(view.technologies.data).flatMap(({ icon }) => (icon ? [icon] : [])),
    ]);
    const unusedImage = next.media.find(({ path }) => !referencedImages.has(path));
    if (unusedImage) {
      setActiveSection('images');
      throw new Error(
        `Attach ${unusedImage.filename} to a project or technology, or remove it from the draft before submitting.`,
      );
    }
    if (!(await updateDraft(() => next))) {
      throw new Error('The draft could not be saved in this browser. Free storage and retry.');
    }
    if (promotedSlug || promotedPostSlug) {
      setSnapshot((current) => current && applyDraft(baseline, next));
      if (promotedPostSlug) {
        setSelectedPostSlug(promotedPostSlug);
        setNewPostSlug('');
        const post = next.posts?.upsert.find((item) => item.slug === promotedPostSlug);
        if (post) {
          postForm.reset(post.data);
        }
      }
      if (promotedSlug && !selectedProjectSlug && newProjectSlug.trim() === promotedSlug) {
        setSelectedProjectSlug(promotedSlug);
        setNewProjectSlug('');
        const promoted = next.projects.upsert.find((project) => project.slug === promotedSlug);
        if (promoted) {
          projectForm.reset(promoted.data);
        }
      }
    }
    return next;
  }

  async function submitDraft() {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusySection('submit');
    setMessages({});
    setFinalMessage(undefined);
    let prepared: CmsDraft;
    try {
      prepared = await prepareDraft();
    } catch (error) {
      setFinalMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Check the draft before submitting.',
      });
      busyRef.current = false;
      setBusySection(null);
      return;
    }
    const baseline = remoteSnapshotRef.current;
    if (!baseline) {
      setFinalMessage({
        tone: 'error',
        text: 'Reload the repository before reviewing this draft.',
      });
      busyRef.current = false;
      setBusySection(null);
      return;
    }
    const summary = summarizePublishDraft(baseline, prepared);
    if (
      !(await confirm({
        title: 'Submit all changes?',
        description:
          'All draft changes and selected images will be published together in one commit to the public content repository.',
        details: <PublishSummary summary={summary} />,
        confirmLabel: 'Submit changes',
      }))
    ) {
      busyRef.current = false;
      setBusySection(null);
      return;
    }
    setConflicts([]);
    try {
      const media: Array<(typeof prepared.media)[number] & { blobSha: string }> = [];
      for (const item of prepared.media) {
        const content = await draftStore.readMedia(item.path);
        if (!content) {
          throw new Error(
            `The saved image ${item.filename} is unavailable in this browser. Add it again before submitting.`,
          );
        }
        const response = await fetch('/api/cms/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: item.scope,
            slug: item.slug,
            filename: item.filename,
            mime: item.mime,
            content,
          }),
        });
        const body = await readJson(response);
        if (!response.ok || errorFrom(body)) {
          throw new Error(errorFrom(body) || `Could not prepare ${item.filename}.`);
        }
        if (
          body.path !== item.path ||
          typeof body.blobSha !== 'string' ||
          !/^[a-f0-9]{40}$/i.test(body.blobSha)
        ) {
          throw new Error(`The server returned an invalid result for ${item.filename}.`);
        }
        media.push({ ...item, blobSha: body.blobSha });
      }
      const response = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'finalize',
          repositoryKey: prepared.repository,
          projects: prepared.projects,
          ...(prepared.posts && { posts: prepared.posts }),
          ...(prepared.site && { site: prepared.site }),
          ...(prepared.categories && { categories: prepared.categories }),
          ...(prepared.technologies && { technologies: prepared.technologies }),
          ...(prepared.designs && { designs: prepared.designs }),
          ...(prepared.deleteMedia?.length && { deleteMedia: prepared.deleteMedia }),
          media,
        }),
      });
      const body = await readJson(response);
      if (response.status === 409) {
        try {
          setConflicts(await loadConflictReview(body, prepared));
          setFinalMessage({
            tone: 'conflict',
            text: 'The repository changed. Review the latest content below; your browser draft is intact.',
          });
        } catch (error) {
          setFinalMessage({
            tone: 'error',
            text:
              error instanceof Error
                ? error.message
                : 'The repository changed. Your draft is intact.',
          });
        }
        return;
      }
      if (!response.ok || errorFrom(body)) {
        throw new Error(errorFrom(body) || 'The draft could not be submitted.');
      }
      const commitUrl =
        typeof body.commitUrl === 'string' ? safeCommitUrl(body.commitUrl) : undefined;
      const pendingRefresh = body.cache !== 'refreshed';
      projectForm.reset(projectForm.getValues());
      postForm.reset(postForm.getValues());
      setNewPostSlug('');
      siteForm.reset(siteForm.getValues());
      categoriesForm.reset(categoriesForm.getValues());
      technologiesForm.reset(technologiesForm.getValues());
      setNewProjectSlug('');
      const cleared = await updateDraft(() => ({
        ...emptyDraft(prepared.repository),
        ...(pendingRefresh && { pendingRefresh: { commitUrl } }),
      }));
      if (cleared) {
        await draftStore.removeMedia(prepared.media.map((item) => item.path));
      }
      setFinalMessage({
        tone: cleared ? 'success' : 'error',
        text: !cleared
          ? 'The commit succeeded, but the browser could not clear its saved draft. Discard the old draft before editing again.'
          : pendingRefresh
            ? 'The commit succeeded. Public refresh is pending; retry it without submitting again.'
            : 'All changes were submitted in one commit. Public content is refreshing.',
        commitUrl,
      });
      loadedSnapshotRef.current = false;
      setDiscardVersions(
        (value) =>
          Object.fromEntries(
            Object.entries(value).map(([key, version]) => [key, version + 1]),
          ) as Record<CmsSection, number>,
      );
      await refreshSnapshot({ initial: true });
    } catch (error) {
      setFinalMessage({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Submission failed. Your draft is still saved in this browser.',
      });
    } finally {
      busyRef.current = false;
      setBusySection(null);
    }
  }

  async function acceptReviewedVersions() {
    if (!conflicts.length || conflicts.some((item) => !item.canRebase)) {
      return;
    }
    if (
      !(await confirm({
        title: 'Use reviewed versions as baseline?',
        description:
          'Your draft will replace the reviewed fields on the next submission. Any further repository changes will still require review.',
        confirmLabel: 'Use reviewed versions',
      }))
    ) {
      return;
    }
    if (await updateDraft((value) => rebaseReviewedVersions(value, conflicts))) {
      setConflicts([]);
      setFinalMessage({
        tone: 'success',
        text: 'Reviewed versions are the new baseline. Submit again when ready.',
      });
      await refreshSnapshot();
    }
  }

  async function discardDraft() {
    if (busyRef.current) {
      return;
    }
    if (
      !(await confirm({
        title: 'Discard browser draft?',
        description:
          'All unsubmitted changes and staged images in this browser will be removed.' +
          (getDraft().pendingRefresh
            ? ' The published commit will remain, but the option to retry its pending public refresh will also be removed.'
            : ''),
        confirmLabel: 'Discard draft',
        danger: true,
      }))
    ) {
      return;
    }
    busyRef.current = true;
    setBusySection('submit');
    try {
      if (!(await draftStore.clear())) {
        return;
      }
      projectForm.reset(emptyProject());
      postForm.reset(emptyPost());
      setSelectedPostSlug('');
      setNewPostSlug('');
      siteForm.reset(emptySite());
      categoriesForm.reset({});
      technologiesForm.reset({});
      setNewProjectSlug('');
      loadedSnapshotRef.current = false;
      setConflicts([]);
      setDiscardVersions(
        (value) =>
          Object.fromEntries(
            Object.entries(value).map(([key, version]) => [key, version + 1]),
          ) as Record<CmsSection, number>,
      );
      setFinalMessage({ tone: 'success', text: 'Browser draft discarded.' });
      await refreshSnapshot({ initial: true });
    } finally {
      busyRef.current = false;
      setBusySection(null);
    }
  }

  async function selectProject(slug: string): Promise<boolean> {
    if (slug === selectedProjectSlug) {
      return true;
    }
    if (
      snapshot &&
      (selectedProjectSlug || projectForm.formState.isDirty || newProjectSlug.trim())
    ) {
      const data = projectForm.getValues();
      let saved: boolean;
      if (selectedProjectSlug) {
        const baseline = remoteSnapshotRef.current?.projects.find(
          (project) => project.slug === selectedProjectSlug,
        );
        saved = await updateDraft((value) =>
          synchronizeProject(value, selectedProjectSlug, baseline, data),
        );
      } else {
        saved = await updateDraft((value) => ({
          ...value,
          newProject: { slug: newProjectSlug, data },
        }));
      }
      if (!saved) {
        setSectionMessage('projects', {
          tone: 'error',
          text: 'The project draft could not be saved in this browser. Resolve the storage issue before switching projects.',
        });
        return false;
      }
    }
    const savedNew = !slug ? getDraft().newProject : undefined;
    const view = snapshot && applyDraft(remoteSnapshotRef.current ?? snapshot, getDraft());
    const next = view?.projects.find((project) => project.slug === slug);
    if (slug && !next) {
      return false;
    }
    setSelectedProjectSlug(slug);
    setNewProjectSlug(savedNew?.slug || '');
    projectForm.reset(savedNew?.data || next?.data || emptyProject());
    clearSectionMessage('projects');
    return true;
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

  async function refreshPublicContent() {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusySection('site');
    try {
      const response = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'revalidate', target: 'all' }),
      });
      const body = await readJson(response);
      if (!response.ok || errorFrom(body) || body.cache === 'pending') {
        throw new Error(errorFrom(body) || 'Public content refresh is still pending.');
      }
      if (getDraft().pendingRefresh) {
        await updateDraft((value) => ({ ...value, pendingRefresh: undefined }));
      }
      setFinalMessage({ tone: 'success', text: 'Public content refresh requested.' });
    } catch (error) {
      setFinalMessage({
        tone: 'error',
        text: `${error instanceof Error ? error.message : 'Public content refresh failed.'} You can retry without creating another commit.`,
      });
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
      <div className="cms-editor-context">
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
      </div>

      {loadState === 'loading' && !snapshot && (
        <p className="cms-editor-loading" role="status">
          Loading CMS content…
        </p>
      )}

      {loadState === 'error' && !snapshot && (
        <section className="cms-editor-state-card" aria-labelledby="cms-load-error-heading">
          <h3 id="cms-load-error-heading">CMS content could not be loaded</h3>
          <p role="alert">{loadError || 'Refresh the content snapshot and try again.'}</p>
          <Button kind="action" type="button" onClick={() => void retryLoad()} disabled={pending}>
            Retry loading
          </Button>
          {(hasDraftChanges(draft) || draft.pendingRefresh || draftStore.error) && (
            <Button
              kind="action"
              type="button"
              variant="outline"
              className="cms-editor-danger-button"
              onClick={() => void discardDraft()}
              disabled={pending}
            >
              Delete draft
            </Button>
          )}
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
          <Button
            kind="action"
            type="button"
            onClick={() => void initializeRepository()}
            disabled={pending}
          >
            {pending ? 'Initializing…' : 'Initialize content repository'}
          </Button>
        </section>
      )}

      {loadState === 'ready' && snapshot && (
        <>
          {headerActions &&
            createPortal(
              <>
                <Button
                  kind="action"
                  type="button"
                  disabled={pending || !hasUnsavedChanges}
                  onClick={() => void submitDraft()}
                >
                  {busySection === 'submit' ? 'Submitting…' : 'Submit draft'}
                </Button>
                <Button
                  kind="action"
                  type="button"
                  variant="outline"
                  className="cms-header-danger-button"
                  disabled={pending || !hasUnsavedChanges}
                  onClick={() => void discardDraft()}
                >
                  Delete draft
                </Button>
              </>,
              headerActions,
            )}
          <div className="cms-editor-dashboard">
            <aside className="cms-editor-sidebar">
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
            </aside>
            <div className="cms-editor-workspace">
              {draftStore.saving && <p role="status">Saving draft in this browser…</p>}
              {draft.pendingRefresh && (
                <div className="cms-editor-pending-refresh" role="status">
                  <p>
                    The commit succeeded; public refresh is pending. Retrying will not create
                    another commit.
                  </p>
                  <Button
                    kind="action"
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => void refreshPublicContent()}
                  >
                    Retry public refresh
                  </Button>
                </div>
              )}
              {draftStore.error && (
                <p className="cms-editor-field-error" role="alert">
                  {draftStore.error}
                </p>
              )}
              {conflicts.length > 0 && (
                <section className="cms-editor-conflicts" aria-labelledby="cms-conflicts-heading">
                  <h3 id="cms-conflicts-heading">Review conflicting changes</h3>
                  <p>
                    Compare your draft with the latest repository content before choosing what to
                    do. Nothing has been committed.
                  </p>
                  {conflicts.some((item) => item.path === '@repository') && (
                    <p>
                      Return to the repository and branch where this draft was created, or discard
                      the draft before editing the new target.
                    </p>
                  )}
                  {conflicts.map((item) => (
                    <details key={item.path}>
                      <summary>{item.path}</summary>
                      <p>Latest repository version</p>
                      <pre>
                        {typeof item.latest === 'string'
                          ? item.latest
                          : JSON.stringify(item.latest, null, 2)}
                      </pre>
                      <p>Your draft</p>
                      <pre>
                        {typeof item.draft === 'string'
                          ? item.draft
                          : JSON.stringify(item.draft, null, 2)}
                      </pre>
                    </details>
                  ))}
                  <Button
                    kind="action"
                    type="button"
                    variant="outline"
                    onClick={() => void acceptReviewedVersions()}
                    disabled={pending || conflicts.some((item) => !item.canRebase)}
                  >
                    Use reviewed versions as baseline
                  </Button>
                </section>
              )}
              {loadError && (
                <div className="cms-editor-message cms-editor-message-error" role="alert">
                  <p>{loadError}</p>
                  <Button
                    kind="action"
                    type="button"
                    className="cms-editor-text-button"
                    variant="text"
                    onClick={() => void retryLoad()}
                    disabled={pending}
                  >
                    Reload repository snapshot
                  </Button>
                </div>
              )}
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
                showImportLink
                selectedSlug={selectedProjectSlug}
                newSlug={newProjectSlug}
                pending={pending}
                feedback={
                  <CmsMessage
                    message={messages.projects}
                    onDismiss={() => clearSectionMessage('projects')}
                  />
                }
                onSelectedSlugChange={selectProject}
                onNewSlugChange={(slug) => {
                  setNewProjectSlug(slug);
                  clearSectionMessage('projects');
                }}
                onSave={saveProject}
                onDelete={deleteProject}
                onClearMessage={() => clearSectionMessage('projects')}
              />
              <PostsPanel
                key={`posts:${discardVersions.posts}`}
                form={postForm}
                snapshot={snapshot}
                active={activeSection === 'posts'}
                selectedSlug={selectedPostSlug}
                newSlug={newPostSlug}
                pending={pending}
                onSelectedSlugChange={selectPost}
                onNewSlugChange={setNewPostSlug}
                onSave={savePost}
                onDelete={deletePost}
                onClearMessage={() => clearSectionMessage('posts')}
                feedback={
                  <CmsMessage
                    message={messages.posts}
                    onDismiss={() => clearSectionMessage('posts')}
                  />
                }
              />
              <SiteProfilePanel
                key={`site:${discardVersions.site}`}
                form={siteForm}
                projects={snapshot?.projects ?? []}
                active={activeSection === 'site'}
                pending={pending}
                feedback={
                  <CmsMessage
                    message={messages.site}
                    onDismiss={() => clearSectionMessage('site')}
                  />
                }
                onSave={saveSite}
                onClearMessage={() => clearSectionMessage('site')}
              />
              <CategoriesPanel
                key={`categories:${discardVersions.categories}`}
                form={categoriesForm}
                active={activeSection === 'categories'}
                pending={pending}
                feedback={
                  <CmsMessage
                    message={messages.categories}
                    onDismiss={() => clearSectionMessage('categories')}
                  />
                }
                onSave={saveCategories}
                onClearMessage={() => clearSectionMessage('categories')}
              />
              <TechnologiesPanel
                key={`technologies:${discardVersions.technologies}`}
                form={technologiesForm}
                active={activeSection === 'technologies'}
                pending={pending}
                feedback={
                  <CmsMessage
                    message={messages.technologies}
                    onDismiss={() => clearSectionMessage('technologies')}
                  />
                }
                onSave={saveTechnologies}
                onClearMessage={() => clearSectionMessage('technologies')}
              />
              <DesignsPanel
                key={`designs:${discardVersions.designs}`}
                active={activeSection === 'designs'}
                pending={pending}
                feedback={
                  <CmsMessage
                    message={messages.designs}
                    onDismiss={() => clearSectionMessage('designs')}
                  />
                }
                onClearMessage={() => clearSectionMessage('designs')}
              />
              <ImagesPanel
                key={`images:${discardVersions.images}`}
                projectForm={projectForm}
                technologiesForm={technologiesForm}
                snapshot={snapshot}
                selectedProjectSlug={selectedProjectSlug}
                newProjectSlug={newProjectSlug}
                active={activeSection === 'images'}
                pending={pending}
                feedback={
                  <CmsMessage
                    message={messages.images}
                    onDismiss={() => clearSectionMessage('images')}
                  />
                }
                onUpload={uploadImage}
                onEditReferences={async (kind, slug) => {
                  if (kind === 'project' && slug) {
                    const selected = await selectProject(slug);
                    if (!selected) {
                      return;
                    }
                  }
                  setActiveSection(kind === 'project' ? 'projects' : 'technologies');
                }}
                onClearMessage={() => clearSectionMessage('images')}
              />
            </div>
          </div>
        </>
      )}
      <CmsMessage message={finalMessage} onDismiss={() => setFinalMessage(undefined)} />
      {confirmationDialog}
    </section>
  );
}
