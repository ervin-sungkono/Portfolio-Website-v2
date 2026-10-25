import type { ImagesPanelProps } from './type';
import './style.css';
import { useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { Technologies } from '@/lib/cms/schemas';
import { CmsMessage } from '../CmsMessage';

const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxImageSize = 1024 * 1024;
const projectSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function safeCommitUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function ImagesPanel({
  projectForm,
  technologiesForm,
  selectedProjectSlug,
  newProjectSlug,
  active,
  pending,
  message,
  result,
  onUpload,
  onClearMessage,
  onReload,
  onRetry,
}: ImagesPanelProps) {
  const [scope, setScope] = useState<'project' | 'technology'>('project');
  const [file, setFile] = useState<File | null>(null);
  const [validationMessage, setValidationMessage] = useState('');
  const [validationTarget, setValidationTarget] = useState<'file' | 'slug'>('file');
  const [copyMessage, setCopyMessage] = useState('');
  const [technologyId, setTechnologyId] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const projectSlugInput = useRef<HTMLInputElement>(null);
  const technologies = useWatch({ control: technologiesForm.control }) || {};
  const technologyEntries = Object.entries(technologies) as Array<[string, Technologies[string]]>;
  const uploadSlug =
    scope === 'technology' ? 'technologies' : selectedProjectSlug || newProjectSlug.trim();
  const projectSlugMatches =
    result?.scope === 'project' && result.slug === (selectedProjectSlug || newProjectSlug.trim());

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationMessage('');
    onClearMessage();
    if (!file) {
      setValidationMessage('Choose an image file to upload.');
      setValidationTarget('file');
      fileInput.current?.focus();
      return;
    }
    if (!allowedMimeTypes.has(file.type)) {
      setValidationMessage('Choose a PNG, JPEG, or WebP image.');
      setValidationTarget('file');
      fileInput.current?.focus();
      return;
    }
    if (file.size > maxImageSize) {
      setValidationMessage('Choose an image no larger than 1 MiB.');
      setValidationTarget('file');
      fileInput.current?.focus();
      return;
    }
    if (scope === 'project' && !projectSlugPattern.test(uploadSlug)) {
      setValidationMessage('Select a project or enter a valid project slug before uploading.');
      setValidationTarget('slug');
      projectSlugInput.current?.focus();
      return;
    }
    void onUpload(file, uploadSlug, scope);
  }

  async function copyPath() {
    if (!result) {
      return;
    }
    try {
      await navigator.clipboard.writeText(result.path);
      setCopyMessage('Image path copied.');
    } catch {
      setCopyMessage('Copy is unavailable here. Select the image path above and copy it.');
    }
  }

  function setAsCover() {
    if (!result || !projectSlugMatches) {
      return;
    }
    projectForm.setValue('media.cover', result.path, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setCopyMessage('Cover path added to the project draft. Save the project to publish it.');
  }

  function addToGallery() {
    if (!result || !projectSlugMatches) {
      return;
    }
    const gallery = projectForm.getValues('media.gallery') || [];
    if (gallery.includes(result.path)) {
      setCopyMessage('This image is already in the project gallery.');
      return;
    }
    projectForm.setValue('media.gallery', [...gallery, result.path], {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setCopyMessage('Image added to the project draft. Save the project to publish it.');
  }

  function setAsTechnologyIcon() {
    if (!result || result.scope !== 'technology' || !technologyId) {
      return;
    }
    const values = technologiesForm.getValues();
    technologiesForm.reset(
      { ...values, [technologyId]: { ...values[technologyId], icon: result.path } },
      { keepDefaultValues: true },
    );
    setCopyMessage('Icon path added to the technology draft. Save technologies to publish it.');
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
            Upload a small image, then add its returned path to a project cover, gallery, or
            technology icon.
          </p>
        </div>
      </div>
      <CmsMessage message={message} onReload={onReload} onRetry={onRetry} pending={pending} />
      <form className="cms-editor-form cms-editor-upload-form" onSubmit={submit} noValidate>
        <fieldset disabled={pending}>
          <label className="cms-editor-field">
            <span>Image destination</span>
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as 'project' | 'technology');
                setValidationMessage('');
                setValidationTarget('file');
                setCopyMessage('');
              }}
            >
              <option value="project">Project cover or gallery</option>
              <option value="technology">Technology icon</option>
            </select>
          </label>
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
                Select a project in Projects, or enter the new project slug there first.
              </span>
            </label>
          ) : (
            <p className="cms-editor-hint">
              This upload uses the shared <code>media/technologies/</code> folder.
            </p>
          )}
          <label className="cms-editor-field">
            <span>Choose image</span>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setValidationMessage('');
                setValidationTarget('file');
                setCopyMessage('');
              }}
              aria-invalid={Boolean(validationMessage && validationTarget === 'file')}
              aria-describedby={
                validationMessage && validationTarget === 'file'
                  ? 'cms-image-file-error'
                  : 'cms-image-file-help'
              }
            />
            <span className="cms-editor-hint" id="cms-image-file-help">
              PNG, JPEG, or WebP, up to 1 MiB.
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
          <button className="button" type="submit" disabled={pending || !file}>
            {pending ? 'Uploading image…' : 'Upload image'}
          </button>
        </fieldset>
      </form>

      {result && (
        <div className="cms-editor-upload-result">
          <h3>Image uploaded</h3>
          <label className="cms-editor-field">
            <span>Repository path</span>
            <input value={result.path} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>
          {safeCommitUrl(result.commitUrl) && (
            <a href={safeCommitUrl(result.commitUrl)} target="_blank" rel="noreferrer">
              View image commit
            </a>
          )}
          <div className="cms-editor-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => void copyPath()}
              disabled={pending}
            >
              Copy path
            </button>
            {result.scope === 'project' && projectSlugMatches && (
              <>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={setAsCover}
                  disabled={pending}
                >
                  Use as cover
                </button>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={addToGallery}
                  disabled={pending}
                >
                  Add to gallery
                </button>
              </>
            )}
            {result.scope === 'technology' && (
              <>
                <label className="cms-editor-field cms-editor-technology-picker">
                  <span>Technology</span>
                  <select
                    value={technologyId}
                    onChange={(event) => setTechnologyId(event.target.value)}
                    disabled={pending}
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
                  onClick={setAsTechnologyIcon}
                  disabled={pending || !technologyId}
                >
                  Use as technology icon
                </button>
              </>
            )}
          </div>
          {result.scope === 'project' && !projectSlugMatches && (
            <p className="cms-editor-hint">
              This image belongs to project “{result.slug}”. Select that project to add the path.
            </p>
          )}
          {copyMessage && (
            <p className="cms-editor-hint" role="status">
              {copyMessage}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
