import type { ProjectPanelProps } from './type';
import './style.css';
import type { FormEvent } from 'react';
import type { FieldErrorProps } from '../type';
import { useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import { CmsMessage } from '../CmsMessage';

function FieldError({ id, message }: FieldErrorProps) {
  return message ? (
    <p className="cms-editor-field-error" id={id}>
      {message}
    </p>
  ) : null;
}

function slugIsValid(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function ProjectPanel({
  form,
  snapshot,
  active,
  selectedSlug,
  newSlug,
  pending,
  message,
  onSelectedSlugChange,
  onNewSlugChange,
  onSave,
  onDelete,
  onClearMessage,
  onReload,
  onRetry,
}: ProjectPanelProps) {
  const { register, control, formState, getFieldState } = form;
  const slugInput = useRef<HTMLInputElement>(null);
  const [slugSubmitError, setSlugSubmitError] = useState('');
  const slug = selectedSlug || newSlug;
  const slugError = selectedSlug
    ? ''
    : newSlug && !slugIsValid(newSlug)
      ? 'Use lowercase letters, numbers, and single hyphens.'
      : newSlug
        ? ''
        : slugSubmitError;
  const categoryError = getFieldState('categories').error?.message;
  const techError = getFieldState('technologies').error?.message;
  const tagsError = getFieldState('tags').error?.message;
  const coverError = getFieldState('media.cover').error?.message;

  function submit(event: FormEvent<HTMLFormElement>) {
    onClearMessage();
    void form.handleSubmit(async (data) => {
      if (!selectedSlug && !slugIsValid(newSlug.trim())) {
        setSlugSubmitError(
          'Enter a project URL slug using lowercase letters, numbers, and single hyphens.',
        );
        slugInput.current?.focus();
        return;
      }
      setSlugSubmitError('');
      await onSave(data);
    })(event);
  }

  return (
    <section
      id="cms-editor-projects-panel"
      className="cms-editor-panel cms-editor-project-panel"
      aria-labelledby="cms-projects-heading"
      hidden={!active}
    >
      <div className="cms-editor-panel-heading">
        <div>
          <p className="eyebrow">Content collection</p>
          <h2 id="cms-projects-heading">Projects</h2>
        </div>
        <label className="cms-editor-field cms-editor-project-picker">
          <span>Choose a project</span>
          <select
            value={selectedSlug}
            disabled={pending}
            onChange={(event) => {
              setSlugSubmitError('');
              onSelectedSlugChange(event.target.value);
            }}
          >
            <option value="">New project</option>
            {snapshot.projects.map((project) => (
              <option value={project.slug} key={project.slug}>
                {project.data.title} ({project.slug})
              </option>
            ))}
          </select>
        </label>
      </div>

      <CmsMessage message={message} onReload={onReload} onRetry={onRetry} pending={pending} />

      <form className="cms-editor-form" onSubmit={submit} onChange={onClearMessage} noValidate>
        <fieldset disabled={pending}>
          {!selectedSlug && (
            <label className="cms-editor-field cms-editor-slug-field">
              <span>Project URL slug</span>
              <input
                ref={slugInput}
                value={newSlug}
                onChange={(event) => {
                  setSlugSubmitError('');
                  onNewSlugChange(event.target.value.toLowerCase());
                }}
                autoComplete="off"
                maxLength={80}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                aria-invalid={Boolean(slugError)}
                aria-describedby={slugError ? 'cms-project-slug-error' : undefined}
                required
              />
              {slugError && <FieldError id="cms-project-slug-error" message={slugError} />}
              <span className="cms-editor-hint">
                This becomes the public project URL and cannot be changed after saving.
              </span>
            </label>
          )}

          <div className="cms-editor-grid">
            <label className="cms-editor-field">
              <span>Title</span>
              <input
                {...register('title')}
                maxLength={120}
                aria-invalid={Boolean(formState.errors.title)}
                aria-describedby={formState.errors.title ? 'cms-project-title-error' : undefined}
                required
              />
              <FieldError id="cms-project-title-error" message={formState.errors.title?.message} />
            </label>
            <label className="cms-editor-field">
              <span>Summary</span>
              <input
                {...register('summary')}
                maxLength={240}
                aria-invalid={Boolean(formState.errors.summary)}
                aria-describedby={
                  formState.errors.summary ? 'cms-project-summary-error' : undefined
                }
                required
              />
              <FieldError
                id="cms-project-summary-error"
                message={formState.errors.summary?.message}
              />
            </label>
          </div>

          <label className="cms-editor-field">
            <span>Description</span>
            <textarea
              {...register('description')}
              rows={7}
              maxLength={10_000}
              aria-invalid={Boolean(formState.errors.description)}
              aria-describedby={
                formState.errors.description ? 'cms-project-description-error' : undefined
              }
              required
            />
            <FieldError
              id="cms-project-description-error"
              message={formState.errors.description?.message}
            />
          </label>

          <div className="cms-editor-grid cms-editor-grid-compact">
            <label className="cms-editor-field">
              <span>Year</span>
              <input
                type="number"
                min={1900}
                max={2200}
                step={1}
                {...register('year', { valueAsNumber: true })}
                aria-invalid={Boolean(formState.errors.year)}
                aria-describedby={formState.errors.year ? 'cms-project-year-error' : undefined}
              />
              <FieldError id="cms-project-year-error" message={formState.errors.year?.message} />
            </label>
            <label className="cms-editor-field">
              <span>Sort order</span>
              <input
                type="number"
                min={0}
                max={100_000}
                step={1}
                {...register('sortOrder', { valueAsNumber: true })}
                aria-invalid={Boolean(formState.errors.sortOrder)}
                aria-describedby={formState.errors.sortOrder ? 'cms-project-sort-error' : undefined}
              />
              <FieldError
                id="cms-project-sort-error"
                message={formState.errors.sortOrder?.message}
              />
            </label>
          </div>

          <div className="cms-editor-checkbox-list">
            <label className="cms-editor-checkbox">
              <input type="checkbox" {...register('published')} />
              <span>Published on the public site</span>
            </label>
            <label className="cms-editor-checkbox">
              <input type="checkbox" {...register('featured')} />
              <span>Featured project</span>
            </label>
          </div>
          <p className="cms-editor-hint">
            Unpublished project files and their Git history remain public in the content repository.
            This setting only controls whether the project appears on the portfolio site.
          </p>

          <fieldset
            className="cms-editor-choice-group"
            aria-invalid={Boolean(categoryError)}
            aria-describedby={categoryError ? 'cms-project-categories-error' : undefined}
          >
            <legend>Categories</legend>
            {Object.entries(snapshot.categories.data).length ? (
              <div className="cms-editor-check-grid">
                {Object.entries(snapshot.categories.data)
                  .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
                  .map(([id, category]) => (
                    <label className="cms-editor-checkbox" key={id}>
                      <input
                        type="checkbox"
                        value={id}
                        {...register('categories')}
                        aria-invalid={Boolean(categoryError)}
                        aria-describedby={
                          categoryError ? 'cms-project-categories-error' : undefined
                        }
                      />
                      <span>{category.label}</span>
                    </label>
                  ))}
              </div>
            ) : (
              <p className="cms-editor-hint">
                Add and save a category before assigning one to a project.
              </p>
            )}
            <FieldError id="cms-project-categories-error" message={categoryError} />
          </fieldset>

          <fieldset
            className="cms-editor-choice-group"
            aria-invalid={Boolean(techError)}
            aria-describedby={techError ? 'cms-project-technologies-error' : undefined}
          >
            <legend>Technologies</legend>
            {Object.entries(snapshot.technologies.data).length ? (
              <div className="cms-editor-check-grid">
                {Object.entries(snapshot.technologies.data)
                  .sort(([, a], [, b]) => a.label.localeCompare(b.label))
                  .map(([id, technology]) => (
                    <label className="cms-editor-checkbox" key={id}>
                      <input
                        type="checkbox"
                        value={id}
                        {...register('technologies')}
                        aria-invalid={Boolean(techError)}
                        aria-describedby={techError ? 'cms-project-technologies-error' : undefined}
                      />
                      <span>{technology.label}</span>
                    </label>
                  ))}
              </div>
            ) : (
              <p className="cms-editor-hint">
                Add and save a technology before assigning one to a project.
              </p>
            )}
            <FieldError id="cms-project-technologies-error" message={techError} />
          </fieldset>

          <label className="cms-editor-field">
            <span>
              Tags <span className="cms-editor-hint-inline">(one per line)</span>
            </span>
            <Controller
              control={control}
              name="tags"
              render={({ field }) => (
                <textarea
                  ref={field.ref}
                  name={field.name}
                  value={(field.value || []).join('\n')}
                  onBlur={field.onBlur}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value
                        .split('\n')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    )
                  }
                  rows={4}
                  aria-invalid={Boolean(tagsError)}
                  aria-describedby={tagsError ? 'cms-project-tags-error' : undefined}
                />
              )}
            />
            <FieldError id="cms-project-tags-error" message={tagsError} />
          </label>

          <div className="cms-editor-grid">
            <label className="cms-editor-field">
              <span>Demo URL</span>
              <input
                type="url"
                {...register('links.demo', {
                  setValueAs: (value) => (value === '' ? undefined : value),
                })}
                placeholder="https://example.com"
                aria-invalid={Boolean(formState.errors.links?.demo)}
                aria-describedby={
                  formState.errors.links?.demo ? 'cms-project-demo-error' : undefined
                }
              />
              <FieldError
                id="cms-project-demo-error"
                message={formState.errors.links?.demo?.message}
              />
            </label>
            <label className="cms-editor-field">
              <span>Source URL</span>
              <input
                type="url"
                {...register('links.source', {
                  setValueAs: (value) => (value === '' ? undefined : value),
                })}
                placeholder="https://github.com/…"
                aria-invalid={Boolean(formState.errors.links?.source)}
                aria-describedby={
                  formState.errors.links?.source ? 'cms-project-source-error' : undefined
                }
              />
              <FieldError
                id="cms-project-source-error"
                message={formState.errors.links?.source?.message}
              />
            </label>
          </div>

          <label className="cms-editor-field">
            <span>Cover image path</span>
            <input
              {...register('media.cover')}
              placeholder="Upload an image in the Images section"
              aria-invalid={Boolean(coverError)}
              aria-describedby={coverError ? 'cms-project-cover-error' : 'cms-project-cover-hint'}
              required
            />
            <FieldError id="cms-project-cover-error" message={coverError} />
            <span className="cms-editor-hint" id="cms-project-cover-hint">
              Use a project image uploaded from the Images section.
            </span>
          </label>

          <label className="cms-editor-field">
            <span>
              Gallery image paths <span className="cms-editor-hint-inline">(one per line)</span>
            </span>
            <Controller
              control={control}
              name="media.gallery"
              render={({ field }) => (
                <textarea
                  ref={field.ref}
                  name={field.name}
                  value={(field.value || []).join('\n')}
                  onBlur={field.onBlur}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value
                        .split('\n')
                        .map((path) => path.trim())
                        .filter(Boolean),
                    )
                  }
                  rows={4}
                  aria-invalid={Boolean(formState.errors.media?.gallery)}
                  aria-describedby={
                    formState.errors.media?.gallery ? 'cms-project-gallery-error' : undefined
                  }
                />
              )}
            />
            <FieldError
              id="cms-project-gallery-error"
              message={formState.errors.media?.gallery?.message}
            />
          </label>
        </fieldset>

        <div className="cms-editor-actions">
          <button className="button" type="submit" disabled={pending}>
            {selectedSlug ? 'Save project' : 'Create project'}
          </button>
          {selectedSlug && (
            <button
              className="button cms-editor-danger-button"
              type="button"
              onClick={onDelete}
              disabled={pending}
            >
              Delete project
            </button>
          )}
          {formState.isDirty && (
            <span className="cms-editor-draft-state">Unsaved project changes</span>
          )}
          {slug && <span className="cms-editor-hint">Current URL: /project/{slug}</span>}
        </div>
      </form>
    </section>
  );
}
