'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Select';
import { useWatch } from 'react-hook-form';
import type { ProjectDocument, Technologies } from '@/lib/cms/schemas';
import { useConfirmDialog } from '../../ConfirmDialog';
import { useCmsDraft } from '../../CmsDraftProvider';
import type { DraftMedia } from '../../CmsDraftProvider/type';
import { CmsWizardDialog } from '../../CmsWizardDialog';
import { readJson } from '../response';
import { ImagePreview } from './ImagePreview';
import { stageMediaDeletion } from './media-deletion';
import type { ImagesPanelProps, ImageUploadTarget } from './type';
import './style.css';

const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxImageSize = 1024 * 1024;
const projectSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const mediaPathPattern =
  /^media\/(?:projects\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|jpe?g|webp)|technologies\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|jpe?g|webp|svg))$/i;
type RepositoryImage = { path: string; sha: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function removePathFromProject(project: ProjectDocument, path: string): ProjectDocument {
  const cover = project.media.cover === path ? '' : project.media.cover;
  const gallery = project.media.gallery.filter((item) => item !== path);
  if (cover === project.media.cover && gallery.length === project.media.gallery.length) {
    return project;
  }
  return { ...project, media: { cover, gallery } };
}

function removePathFromTechnologies(technologies: Technologies, path: string): Technologies {
  return Object.fromEntries(
    Object.entries(technologies).map(([id, technology]) => {
      if (technology.icon !== path) {
        return [id, technology];
      }
      const withoutIcon = { ...technology };
      delete withoutIcon.icon;
      return [id, withoutIcon];
    }),
  ) as Technologies;
}

export function ImagesPanel({
  projectForm,
  technologiesForm,
  selectedProjectSlug,
  newProjectSlug,
  snapshot,
  onEditReferences,
  projectOnly = false,
  canUpload = true,
  active,
  pending,
  feedback,
  onUpload,
  onClearMessage,
}: ImagesPanelProps) {
  const [scope, setScope] = useState<'project' | 'technology'>('project');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [validationMessage, setValidationMessage] = useState('');
  const [validationTarget, setValidationTarget] = useState<'destination' | 'file' | 'slug'>('file');
  const [statusMessage, setStatusMessage] = useState('');
  const [technologyIds, setTechnologyIds] = useState<Record<string, string>>({});
  const [removingPaths, setRemovingPaths] = useState<string[]>([]);
  const [isStaging, setIsStaging] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [repositoryImages, setRepositoryImages] = useState<RepositoryImage[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [mediaVersion, setMediaVersion] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectSlugInput = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const { confirm, confirmationDialog } = useConfirmDialog();
  const draftStore = useCmsDraft();
  const technologies = useWatch({ control: technologiesForm.control }) || {};
  const technologyEntries = Object.entries(technologies) as Array<[string, Technologies[string]]>;
  const stagedImages = draftStore.draft.media;
  const uploadSlug = selectedProjectSlug || newProjectSlug.trim();
  const imageInputDisabled =
    pending || isStaging || !canUpload || draftStore.draft.repository.length === 0;

  useEffect(() => {
    if (!active || !snapshot || projectOnly) {
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) {
        return;
      }
      setMediaLoading(true);
      setMediaError('');
      void (async () => {
        try {
          const response = await fetch('/api/cms/media', {
            cache: 'no-store',
            signal: controller.signal,
          });
          const body = await readJson(response);
          const repository = body.repository;
          if (!response.ok || !isRecord(repository) || !Array.isArray(body.media)) {
            throw new Error(
              typeof body.error === 'string' ? body.error : 'Could not load repository images.',
            );
          }
          if (
            repository.owner !== snapshot.repository.owner ||
            repository.name !== snapshot.repository.name ||
            repository.defaultBranch !== snapshot.repository.defaultBranch
          ) {
            throw new Error(
              'The content repository changed. Reload the editor before managing images.',
            );
          }
          const images = body.media.map((entry: unknown) => {
            if (
              !isRecord(entry) ||
              typeof entry.path !== 'string' ||
              !mediaPathPattern.test(entry.path) ||
              typeof entry.sha !== 'string' ||
              !/^[a-f0-9]{40}$/i.test(entry.sha)
            ) {
              throw new Error('The CMS returned an invalid repository image.');
            }
            return { path: entry.path, sha: entry.sha };
          });
          if (!controller.signal.aborted) {
            setRepositoryImages(images);
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setMediaError(
              error instanceof Error ? error.message : 'Could not load repository images.',
            );
          }
        } finally {
          if (!controller.signal.aborted) {
            setMediaLoading(false);
          }
        }
      })();
    });
    return () => controller.abort();
  }, [active, mediaVersion, projectOnly, snapshot]);

  function openWizard() {
    setActiveStep(0);
    setValidationMessage('');
    setValidationTarget('destination');
    onClearMessage();
    setWizardOpen(true);
  }

  function addProjectPath(path: string) {
    const media = projectForm.getValues('media');
    if (!media.cover) {
      projectForm.setValue('media.cover', path, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      projectForm.setValue(
        'media.gallery',
        media.gallery.filter((item) => item !== path),
        { shouldDirty: true, shouldTouch: true, shouldValidate: true },
      );
      return;
    }
    if (media.cover === path || media.gallery.includes(path)) {
      return;
    }
    projectForm.setValue('media.gallery', [...media.gallery, path], {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  function continueToFileSelection() {
    setValidationMessage('');
    if (!canUpload || draftStore.draft.repository.length === 0) {
      setValidationMessage(
        projectOnly
          ? 'Choose a repository and review its public metadata warning before staging images.'
          : 'Wait until the content repository is ready before staging images.',
      );
      setValidationTarget('destination');
      return false;
    }
    if (scope === 'project' && !projectSlugPattern.test(uploadSlug)) {
      setValidationMessage(
        'Select a project or enter a valid project slug in the Projects section before staging images.',
      );
      setValidationTarget('slug');
      projectSlugInput.current?.focus();
      return false;
    }
    return true;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!continueToFileSelection()) {
      setActiveStep(0);
      window.requestAnimationFrame(() => projectSlugInput.current?.focus());
      return;
    }
    setValidationMessage('');
    setStatusMessage('');
    setCopyMessage('');
    onClearMessage();
    if (!files.length) {
      setValidationMessage('Choose one or more image files to stage.');
      setValidationTarget('file');
      fileInput.current?.focus();
      return;
    }
    const invalidFile = files.find(
      (file) => !allowedMimeTypes.has(file.type) || file.size === 0 || file.size > maxImageSize,
    );
    if (invalidFile) {
      setValidationMessage(
        !allowedMimeTypes.has(invalidFile.type)
          ? `${invalidFile.name}: choose a PNG, JPEG, or WebP image.`
          : `${invalidFile.name}: choose an image larger than 0 bytes and no larger than 1 MiB.`,
      );
      setValidationTarget('file');
      fileInput.current?.focus();
      return;
    }
    const target: ImageUploadTarget =
      scope === 'project' ? { kind: 'project', projectSlug: uploadSlug } : { kind: 'technology' };
    let completed = 0;
    setIsStaging(true);
    try {
      for (const file of files) {
        const result = await onUpload(file, target);
        if (scope === 'project') {
          addProjectPath(result.path);
        }
        completed += 1;
      }
      setFiles([]);
      if (fileInput.current) {
        fileInput.current.value = '';
      }
      setStatusMessage(
        `${completed} ${completed === 1 ? 'image was' : 'images were'} saved to the browser draft. Submit the draft in the portfolio editor to publish them.`,
      );
      setWizardOpen(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Choose the image again and retry.';
      setStatusMessage(
        completed
          ? `${completed} ${completed === 1 ? 'image was' : 'images were'} saved to the browser draft before staging stopped. ${detail}`
          : detail,
      );
    } finally {
      setIsStaging(false);
    }
  }

  async function copyPath(path: string) {
    try {
      await navigator.clipboard.writeText(path);
      setCopyMessage('Image path copied.');
    } catch {
      setCopyMessage('Copy is unavailable here. Select the image path and copy it.');
    }
  }

  async function removeRepositoryImage(image: RepositoryImage) {
    if (!snapshot) {
      return;
    }
    const current = {
      selectedSlug: selectedProjectSlug,
      newSlug: newProjectSlug,
      project: projectForm.getValues(),
      technologies: technologiesForm.getValues(),
    };
    let plan: ReturnType<typeof stageMediaDeletion>;
    try {
      plan = stageMediaDeletion(draftStore.get(), snapshot, image, current);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'The image cannot be removed.');
      return;
    }
    const references = plan.affected.length
      ? ` References will be updated in: ${plan.affected.join(', ')}.`
      : ' No current content references this image.';
    const accepted = await confirm({
      title: 'Delete this repository image?',
      description: `${image.path} will be deleted when you submit the draft.${references} A project cover will be replaced by its first gallery image.`,
      confirmLabel: 'Stage image deletion',
      danger: true,
    });
    if (!accepted) {
      return;
    }
    setRemovingPaths((paths) => [...paths, image.path]);
    try {
      plan = stageMediaDeletion(draftStore.get(), snapshot, image, current);
      const save = draftStore.update(() => plan.draft);
      if (plan.selectedProject) {
        projectForm.setValue('media', plan.selectedProject.media, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
      if (plan.technologies !== current.technologies) {
        technologiesForm.reset(plan.technologies, { keepDefaultValues: true });
      }
      const saved = await save;
      setStatusMessage(
        saved
          ? `${image.path} is staged for deletion. Submit the draft to apply it.`
          : 'The browser could not save the image deletion. Resolve the storage issue and retry.',
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'The image could not be staged for deletion.',
      );
    } finally {
      setRemovingPaths((paths) => paths.filter((path) => path !== image.path));
    }
  }

  function setAsTechnologyIcon(image: DraftMedia) {
    const technologyId = technologyIds[image.path];
    if (image.scope !== 'technology' || !technologyId) {
      return;
    }
    const values = technologiesForm.getValues();
    technologiesForm.reset(
      { ...values, [technologyId]: { ...values[technologyId], icon: image.path } },
      { keepDefaultValues: true },
    );
    setStatusMessage(`${image.filename} was added to the ${technologyId} technology draft.`);
  }

  async function removeStagedImage(image: DraftMedia) {
    const accepted = await confirm({
      title: 'Remove this staged image?',
      description: `${image.path} will be removed from the browser draft, and its path will be cleared from staged project and technology data. It will not be included when you submit the draft.`,
      confirmLabel: 'Remove image',
      danger: true,
    });
    if (!accepted) {
      return;
    }

    setRemovingPaths((current) => [...current, image.path]);
    setStatusMessage('');
    try {
      const updated = await draftStore.update((current) => ({
        ...current,
        media: current.media.filter((item) => item.path !== image.path),
        projects: {
          ...current.projects,
          upsert: current.projects.upsert.map((project) => ({
            ...project,
            data: removePathFromProject(project.data, image.path),
          })),
        },
        newProject: current.newProject
          ? {
              ...current.newProject,
              data: removePathFromProject(current.newProject.data, image.path),
            }
          : undefined,
        technologies: current.technologies
          ? {
              ...current.technologies,
              data: removePathFromTechnologies(current.technologies.data, image.path),
            }
          : undefined,
      }));
      if (!updated) {
        setStatusMessage('The image could not be removed from the browser draft.');
        return;
      }

      const media = projectForm.getValues('media');
      if (media.cover === image.path) {
        projectForm.setValue('media.cover', '', {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
      if (media.gallery.includes(image.path)) {
        projectForm.setValue(
          'media.gallery',
          media.gallery.filter((path) => path !== image.path),
          { shouldDirty: true, shouldTouch: true, shouldValidate: true },
        );
      }
      const technologyValues = technologiesForm.getValues();
      const nextTechnologies = removePathFromTechnologies(technologyValues, image.path);
      if (JSON.stringify(technologyValues) !== JSON.stringify(nextTechnologies)) {
        technologiesForm.reset(nextTechnologies, { keepDefaultValues: true });
      }

      const blobRemoved = await draftStore.removeMedia([image.path]);
      setStatusMessage(
        blobRemoved
          ? `${image.filename} was removed from the browser draft.`
          : `${image.filename} was removed from the draft list, but the browser could not clear its cached file.`,
      );
    } finally {
      setRemovingPaths((current) => current.filter((path) => path !== image.path));
    }
  }

  return (
    <section
      id="cms-editor-images-panel"
      className="cms-editor-panel cms-editor-images-panel"
      aria-labelledby="cms-images-heading"
      hidden={!active}
    >
      <div className="cms-editor-panel-heading">
        <div>
          <p className="eyebrow">Repository media</p>
          <h2 id="cms-images-heading">Images</h2>
          <p>
            Stage images in this browser draft. The repository changes only when you submit the
            draft in the portfolio editor.
          </p>
        </div>
      </div>
      {!wizardOpen && feedback}
      {!wizardOpen && draftStore.error && (
        <p className="cms-editor-field-error" role="alert">
          {draftStore.error}
        </p>
      )}
      <div className="cms-editor-image-upload-launcher">
        <Button kind="action" type="button" onClick={openWizard} disabled={pending}>
          {projectOnly ? 'Add project images' : 'Add images'}
        </Button>
        {!wizardOpen && files.length > 0 && (
          <p className="cms-editor-hint" role="status">
            {files.length} {files.length === 1 ? 'file is' : 'files are'} selected, but not yet
            saved to the browser draft. Reopen the image steps and stage them before leaving.
          </p>
        )}
      </div>
      {statusMessage && !wizardOpen && (
        <p className="cms-editor-hint cms-editor-images-status" role="status">
          {statusMessage}
        </p>
      )}
      <CmsWizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="Stage images in browser draft"
        description="Choose a destination, select image files, then stage them in this browser. GitHub changes only after you submit the full draft."
        activeStep={activeStep}
        onStepChange={setActiveStep}
        onNext={continueToFileSelection}
        onSubmit={(event) => void submit(event)}
        onChange={onClearMessage}
        pending={pending || isStaging}
        submitLabel={isStaging ? 'Staging images…' : 'Stage images in browser draft'}
        feedback={
          wizardOpen ? (
            <>
              {feedback}
              {draftStore.error && (
                <p className="cms-editor-field-error" role="alert">
                  {draftStore.error}
                </p>
              )}
              {statusMessage && (
                <p className="cms-editor-hint cms-editor-images-status" role="status">
                  {statusMessage}
                </p>
              )}
            </>
          ) : null
        }
        steps={[
          {
            label: 'Destination',
            content: (
              <div className="cms-editor-form cms-editor-upload-form">
                <fieldset className="cms-editor-form-group" disabled={pending || isStaging}>
                  {!projectOnly && (
                    <div className="cms-editor-field">
                      <span id={`cms-image-destination-label-${inputId}`}>Image destination</span>
                      <Select
                        aria-labelledby={`cms-image-destination-label-${inputId}`}
                        value={scope}
                        onValueChange={(value) => {
                          setScope(value as 'project' | 'technology');
                          setValidationMessage('');
                          setValidationTarget('destination');
                          setStatusMessage('');
                        }}
                        disabled={imageInputDisabled}
                        aria-invalid={Boolean(
                          validationMessage && validationTarget === 'destination',
                        )}
                        aria-describedby={
                          validationMessage && validationTarget === 'destination'
                            ? 'cms-image-destination-error'
                            : undefined
                        }
                        options={[
                          { value: 'project', label: 'Project cover or gallery' },
                          { value: 'technology', label: 'Technology icon' },
                        ]}
                      />
                    </div>
                  )}
                  {scope === 'project' ? (
                    <label className="cms-editor-field">
                      <span>Project slug</span>
                      <input
                        ref={projectSlugInput}
                        value={uploadSlug}
                        readOnly
                        aria-invalid={Boolean(validationMessage && validationTarget === 'slug')}
                        aria-describedby={
                          validationMessage && validationTarget === 'slug'
                            ? 'cms-image-slug-error'
                            : 'cms-image-project-help'
                        }
                      />
                      <span className="cms-editor-hint" id="cms-image-project-help">
                        {projectOnly
                          ? 'These images will be staged for the project selected in the importer.'
                          : 'Select a project in Projects, or enter the new project slug there first.'}
                      </span>
                    </label>
                  ) : (
                    <p className="cms-editor-hint">
                      These images use the shared <code>media/technologies/</code> folder.
                    </p>
                  )}
                  {!canUpload && projectOnly && (
                    <p className="cms-editor-hint">
                      Choose a repository and review its public metadata warning before staging
                      images.
                    </p>
                  )}
                  {validationMessage && validationTarget !== 'file' && (
                    <p
                      className="cms-editor-field-error"
                      id={'cms-image-' + validationTarget + '-error'}
                      role="alert"
                    >
                      {validationMessage}
                    </p>
                  )}
                </fieldset>
              </div>
            ),
          },
          {
            label: 'Choose files',
            content: (
              <div className="cms-editor-form cms-editor-upload-form">
                <fieldset className="cms-editor-form-group" disabled={imageInputDisabled}>
                  <p className="cms-editor-hint">
                    {scope === 'project'
                      ? 'Files will be added to ' +
                        (uploadSlug || 'the selected project') +
                        ': the first image fills an empty cover, and later images join the gallery.'
                      : 'Files will be saved under media/technologies/. You can assign a staged file to a technology after upload.'}
                  </p>
                  <label className="cms-editor-field" htmlFor={inputId}>
                    <span>Choose images</span>
                    <input
                      id={inputId}
                      ref={fileInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      onChange={(event) => {
                        setFiles(Array.from(event.target.files ?? []));
                        setValidationMessage('');
                        setValidationTarget('file');
                        setStatusMessage('');
                      }}
                      aria-invalid={Boolean(validationMessage && validationTarget === 'file')}
                      aria-describedby={
                        validationMessage && validationTarget === 'file'
                          ? 'cms-image-file-error'
                          : 'cms-image-file-help'
                      }
                    />
                    <span className="cms-editor-hint" id="cms-image-file-help">
                      Select one or more PNG, JPEG, or WebP files, up to 1 MiB each. Selected files
                      remain only in this dialog until staging finishes.
                    </span>
                  </label>
                  {validationMessage && validationTarget === 'file' && (
                    <p className="cms-editor-field-error" id="cms-image-file-error" role="alert">
                      {validationMessage}
                    </p>
                  )}
                </fieldset>
              </div>
            ),
          },
        ]}
      />
      {stagedImages.length > 0 && (
        <div className="cms-editor-staged-images">
          <h3>Images in browser draft</h3>
          <ul aria-label="Images in browser draft">
            {stagedImages.map((image) => (
              <li key={image.path}>
                <ImagePreview path={image.path} mime={image.mime} active={active} />
                <div className="cms-editor-staged-image-info">
                  <strong>{image.filename}</strong>
                  <span>
                    {image.scope === 'project' ? `Project: ${image.slug}` : 'Technology icon'}
                  </span>
                  <code>{image.path}</code>
                </div>
                <div className="cms-editor-actions">
                  <Button
                    kind="action"
                    type="button"
                    variant="outline"
                    onClick={() => void copyPath(image.path)}
                    disabled={pending || removingPaths.includes(image.path)}
                  >
                    Copy path
                  </Button>
                  {image.scope === 'technology' && (
                    <>
                      <div className="cms-editor-field cms-editor-technology-picker">
                        <span>{`Technology for ${image.filename}`}</span>
                        <Select
                          aria-label={`Technology for ${image.filename}`}
                          value={technologyIds[image.path] || ''}
                          onValueChange={(value) =>
                            setTechnologyIds((current) => ({
                              ...current,
                              [image.path]: value,
                            }))
                          }
                          disabled={pending || removingPaths.includes(image.path)}
                          placeholder="Choose technology"
                          options={technologyEntries.map(([id, technology]) => ({
                            value: id,
                            label: technology.label || id,
                          }))}
                        />
                      </div>
                      <Button
                        kind="action"
                        type="button"
                        variant="outline"
                        onClick={() => setAsTechnologyIcon(image)}
                        disabled={
                          pending ||
                          removingPaths.includes(image.path) ||
                          !technologyIds[image.path]
                        }
                      >
                        Use as technology icon
                      </Button>
                    </>
                  )}
                  <Button
                    kind="action"
                    type="button"
                    variant="outline"
                    className="cms-editor-danger-button"
                    onClick={() => void removeStagedImage(image)}
                    disabled={pending || removingPaths.includes(image.path)}
                  >
                    {removingPaths.includes(image.path)
                      ? 'Removing image…'
                      : `Remove ${image.filename} from browser draft`}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {snapshot && !projectOnly && (
        <div className="cms-editor-repository-images">
          <div className="cms-editor-images-heading">
            <div>
              <h3>Repository images</h3>
              <p>Existing files and any deletions staged in this browser.</p>
            </div>
            <Button
              kind="action"
              type="button"
              variant="outline"
              onClick={() => setMediaVersion((version) => version + 1)}
              disabled={pending || mediaLoading}
            >
              Reload images
            </Button>
          </div>
          {mediaLoading && <p role="status">Loading repository images…</p>}
          {mediaError && (
            <p className="cms-editor-field-error" role="alert">
              {mediaError}
            </p>
          )}
          {!mediaLoading && !mediaError && repositoryImages.length === 0 && (
            <p>No repository images found.</p>
          )}
          {!mediaError && (
            <ul aria-label="Repository images">
              {repositoryImages.map((image) => {
                const deleted = draftStore.draft.deleteMedia?.some(
                  (item) => item.path === image.path,
                );
                const alsoStaged = stagedImages.some((item) => item.path === image.path);
                const parts = image.path.split('/');
                const isProject = parts[1] === 'projects';
                const url = `https://raw.githubusercontent.com/${[snapshot.repository.owner, snapshot.repository.name, snapshot.repository.defaultBranch, ...parts].map(encodeURIComponent).join('/')}`;
                return (
                  <li key={image.path}>
                    <ImagePreview path={image.path} url={url} active={active} />
                    <div className="cms-editor-staged-image-info">
                      <strong>{parts.at(-1)}</strong>
                      <span>{isProject ? `Project: ${parts[2]}` : 'Technology icon'}</span>
                      <code>{image.path}</code>
                      {deleted && <span>Pending deletion</span>}
                      {alsoStaged && !deleted && (
                        <span>Remove the staged upload before deleting this file.</span>
                      )}
                    </div>
                    <div className="cms-editor-actions">
                      {onEditReferences &&
                        !deleted &&
                        (!isProject ||
                          snapshot.projects.some((project) => project.slug === parts[2])) && (
                          <Button
                            kind="action"
                            type="button"
                            variant="outline"
                            onClick={() =>
                              onEditReferences(
                                isProject ? 'project' : 'technology',
                                isProject ? parts[2] : undefined,
                              )
                            }
                            disabled={pending}
                          >
                            Edit references
                          </Button>
                        )}
                      {!deleted && (
                        <Button
                          kind="action"
                          type="button"
                          variant="outline"
                          className="cms-editor-danger-button"
                          onClick={() => void removeRepositoryImage(image)}
                          disabled={pending || alsoStaged || removingPaths.includes(image.path)}
                        >
                          Delete {parts.at(-1)}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {copyMessage && (
        <p className="cms-editor-hint" role="status">
          {copyMessage}
        </p>
      )}
      {confirmationDialog}
    </section>
  );
}
