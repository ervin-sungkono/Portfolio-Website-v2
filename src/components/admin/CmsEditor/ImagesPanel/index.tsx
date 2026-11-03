'use client';

import { useId, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { ProjectDocument, Technologies } from '@/lib/cms/schemas';
import { useConfirmDialog } from '../../ConfirmDialog';
import { useCmsDraft } from '../../CmsDraftProvider';
import type { DraftMedia } from '../../CmsDraftProvider/type';
import type { ImagesPanelProps, ImageUploadTarget } from './type';
import './style.css';

const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxImageSize = 1024 * 1024;
const projectSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  projectOnly = false,
  canUpload = true,
  active,
  pending,
  feedback,
  onUpload,
  onClearMessage,
}: ImagesPanelProps) {
  const [scope, setScope] = useState<'project' | 'technology'>('project');
  const [files, setFiles] = useState<File[]>([]);
  const [validationMessage, setValidationMessage] = useState('');
  const [validationTarget, setValidationTarget] = useState<'file' | 'slug'>('file');
  const [statusMessage, setStatusMessage] = useState('');
  const [technologyIds, setTechnologyIds] = useState<Record<string, string>>({});
  const [removingPaths, setRemovingPaths] = useState<string[]>([]);
  const [isStaging, setIsStaging] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const projectSlugInput = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const { confirm, confirmationDialog } = useConfirmDialog();
  const draftStore = useCmsDraft();
  const technologies = useWatch({ control: technologiesForm.control }) || {};
  const technologyEntries = Object.entries(technologies) as Array<[string, Technologies[string]]>;
  const stagedImages = draftStore.draft.media;
  const uploadSlug = selectedProjectSlug || newProjectSlug.trim();

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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    if (scope === 'project' && !projectSlugPattern.test(uploadSlug)) {
      setValidationMessage('Select a project or enter a valid project slug before staging images.');
      setValidationTarget('slug');
      projectSlugInput.current?.focus();
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
      {feedback}
      {draftStore.error && (
        <p className="cms-editor-field-error" role="alert">
          {draftStore.error}
        </p>
      )}
      <form
        className="cms-editor-form cms-editor-upload-form"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <fieldset
          disabled={pending || isStaging || !canUpload || draftStore.draft.repository.length === 0}
        >
          {!projectOnly && (
            <label className="cms-editor-field">
              <span>Image destination</span>
              <select
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as 'project' | 'technology');
                  setValidationMessage('');
                  setValidationTarget('file');
                  setStatusMessage('');
                }}
              >
                <option value="project">Project cover or gallery</option>
                <option value="technology">Technology icon</option>
              </select>
            </label>
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
              Choose a repository and review its warning before staging images.
            </p>
          )}
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
              Select one or more PNG, JPEG, or WebP files, up to 1 MiB each.
            </span>
          </label>
          {validationMessage && (
            <p
              className="cms-editor-field-error"
              id={`cms-image-${validationTarget}-error`}
              role="alert"
            >
              {validationMessage}
            </p>
          )}
          <button className="button" type="submit" disabled={pending || isStaging || !files.length}>
            {pending || isStaging ? 'Staging images…' : 'Stage images in browser draft'}
          </button>
        </fieldset>
      </form>

      {statusMessage && (
        <p className="cms-editor-hint cms-editor-images-status" role="status">
          {statusMessage}
        </p>
      )}
      {stagedImages.length > 0 && (
        <div className="cms-editor-staged-images">
          <h3>Images in browser draft</h3>
          <ul aria-label="Images in browser draft">
            {stagedImages.map((image) => (
              <li key={image.path}>
                <div className="cms-editor-staged-image-info">
                  <strong>{image.filename}</strong>
                  <span>
                    {image.scope === 'project' ? `Project: ${image.slug}` : 'Technology icon'}
                  </span>
                  <code>{image.path}</code>
                </div>
                <div className="cms-editor-actions">
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => void copyPath(image.path)}
                    disabled={pending || removingPaths.includes(image.path)}
                  >
                    Copy path
                  </button>
                  {image.scope === 'technology' && (
                    <>
                      <label className="cms-editor-field cms-editor-technology-picker">
                        <span>Technology for {image.filename}</span>
                        <select
                          value={technologyIds[image.path] || ''}
                          onChange={(event) =>
                            setTechnologyIds((current) => ({
                              ...current,
                              [image.path]: event.target.value,
                            }))
                          }
                          disabled={pending || removingPaths.includes(image.path)}
                        >
                          <option value="">Choose technology</option>
                          {technologyEntries.map(([id, technology]) => (
                            <option value={id} key={id}>
                              {technology.label || id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => setAsTechnologyIcon(image)}
                        disabled={
                          pending ||
                          removingPaths.includes(image.path) ||
                          !technologyIds[image.path]
                        }
                      >
                        Use as technology icon
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => void removeStagedImage(image)}
                    disabled={pending || removingPaths.includes(image.path)}
                  >
                    {removingPaths.includes(image.path)
                      ? 'Removing image…'
                      : `Remove ${image.filename} from browser draft`}
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
