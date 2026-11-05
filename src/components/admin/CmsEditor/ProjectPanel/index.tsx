import type { ProjectPanelProps } from './type';
import './style.css';
import type { FormEvent } from 'react';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Select';
import { FieldError } from '../FieldError';
import { useRef, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';
import { CmsWizardDialog } from '../../CmsWizardDialog';
import type { ProjectDocument } from '@/lib/cms/schemas';

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
  feedback,
  allowDelete = true,
  openButtonLabel,
  showImportLink = false,
  onSelectedSlugChange,
  onNewSlugChange,
  onSave,
  onDelete,
  onClearMessage,
}: ProjectPanelProps) {
  const { register, control, formState, getFieldState } = form;
  const watchedProject = useWatch({ control });
  const slugInput = useRef<HTMLInputElement>(null);
  const categorySelect = useRef<HTMLButtonElement>(null);
  const technologySelect = useRef<HTMLButtonElement>(null);
  const tagInput = useRef<HTMLInputElement>(null);
  const [slugSubmitError, setSlugSubmitError] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [switchingProject, setSwitchingProject] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [focusFieldName, setFocusFieldName] = useState<string>();
  const slug = selectedSlug || newSlug;
  const categories = Object.entries(snapshot.categories.data).sort(
    ([, a], [, b]) => a.sortOrder - b.sortOrder,
  );
  const technologies = Object.entries(snapshot.technologies.data).sort(([, a], [, b]) =>
    a.label.localeCompare(b.label),
  );
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
  const galleryError = formState.errors.media?.gallery;
  const galleryItemError = (Object.values(galleryError ?? {}) as unknown[]).find(
    (error): error is { message: string } =>
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string',
  );
  const galleryMessage =
    galleryError?.message ??
    galleryItemError?.message ??
    (galleryError ? 'Check each gallery image path.' : undefined);
  const stepFields: FieldPath<ProjectDocument>[][] = [
    ['title', 'summary', 'description', 'year', 'sortOrder'],
    ['categories', 'technologies', 'tags'],
    ['links.demo', 'links.source', 'media.cover', 'media.gallery'],
  ];

  async function openExistingProject(projectSlug: string, step: number) {
    if (switchingProject) {
      return;
    }
    setSwitchingProject(true);
    try {
      if (await onSelectedSlugChange(projectSlug)) {
        setActiveStep(step);
        setFocusFieldName(undefined);
        setDialogOpen(true);
      }
    } finally {
      setSwitchingProject(false);
    }
  }

  async function openNewProject() {
    if (switchingProject) {
      return;
    }
    setSwitchingProject(true);
    try {
      if (await onSelectedSlugChange('')) {
        setActiveStep(0);
        setFocusFieldName(undefined);
        setDialogOpen(true);
      }
    } finally {
      setSwitchingProject(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    onClearMessage();
    void form.handleSubmit(
      async (data) => {
        if (!selectedSlug && !slugIsValid(newSlug.trim())) {
          setSlugSubmitError(
            'Enter a project URL slug using lowercase letters, numbers, and single hyphens.',
          );
          setFocusFieldName('slug');
          setActiveStep(0);
          return;
        }
        setSlugSubmitError('');
        await onSave(data);
        setTagDraft('');
      },
      () => {
        for (const [index, names] of stepFields.entries()) {
          const invalidName = names.find((name) => form.getFieldState(name).error);
          if (invalidName) {
            setFocusFieldName(invalidName);
            setActiveStep(index);
            return;
          }
        }
      },
    )(event);
  }

  async function validateStep() {
    if (activeStep === 0 && !selectedSlug && !slugIsValid(newSlug.trim())) {
      setSlugSubmitError(
        'Enter a project URL slug using lowercase letters, numbers, and single hyphens.',
      );
      slugInput.current?.focus();
      return false;
    }
    setFocusFieldName(undefined);
    return form.trigger(stepFields[activeStep], { shouldFocus: true });
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
          <h2 id="cms-projects-heading">Projects</h2>
        </div>
        {showImportLink && (
          <div className="cms-editor-project-header-actions">
            <Button
              kind="action"
              type="button"
              onClick={() => void openNewProject()}
              disabled={pending || switchingProject}
            >
              Add project
            </Button>
            <Button kind="link" variant="outline" href="/admin/import" showArrow={false}>
              Import repository
            </Button>
          </div>
        )}
        {!showImportLink && (
          <div className="cms-editor-project-picker-row">
            <label className="cms-editor-field cms-editor-project-picker">
              <span>Choose a project</span>
              <Select
                value={selectedSlug}
                disabled={pending}
                onValueChange={(value) => {
                  setSlugSubmitError('');
                  setFocusFieldName(undefined);
                  void onSelectedSlugChange(value);
                }}
                options={[
                  { value: '', label: 'New project' },
                  ...snapshot.projects.map((project) => ({
                    value: project.slug,
                    label: `${project.data.title} (${project.slug})`,
                  })),
                ]}
              />
            </label>
            <Button
              kind="action"
              type="button"
              onClick={() => {
                setActiveStep(0);
                setFocusFieldName(undefined);
                setDialogOpen(true);
              }}
              disabled={pending}
            >
              {openButtonLabel || (selectedSlug ? 'Edit project' : 'Add project')}
            </Button>
          </div>
        )}
      </div>

      <div className="cms-editor-project-overview-table-wrap">
        <table className="cms-editor-project-overview-table" aria-label="Current projects">
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col">Slug</th>
              <th scope="col">Year</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.projects.map(({ slug: projectSlug, data }) => {
              const effectiveData = projectSlug === selectedSlug ? (watchedProject ?? data) : data;
              return (
                <tr key={projectSlug}>
                  <th scope="row">{effectiveData.title}</th>
                  <td>{projectSlug}</td>
                  <td>{effectiveData.year}</td>
                  <td>{effectiveData.published ? 'Published' : 'Draft'}</td>
                  <td>
                    <div className="cms-editor-project-overview-actions">
                      <Button
                        kind="action"
                        type="button"
                        variant="outline"
                        disabled={pending || switchingProject}
                        aria-label={`Edit project ${effectiveData.title}`}
                        onClick={() => void openExistingProject(projectSlug, 0)}
                      >
                        Edit
                      </Button>
                      {allowDelete && (
                        <Button
                          kind="action"
                          type="button"
                          variant="outline"
                          disabled={pending || switchingProject}
                          aria-label={`Delete project ${effectiveData.title}`}
                          onClick={() => void openExistingProject(projectSlug, 2)}
                          className="cms-editor-danger-button"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {snapshot.projects.length === 0 && (
              <tr>
                <td colSpan={5}>No projects are configured.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {slug && <p className="cms-editor-hint">Current URL: /project/{slug}</p>}

      <CmsWizardDialog
        open={active && dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={selectedSlug ? 'Edit project' : 'Add project'}
        description={
          selectedSlug
            ? `Editing /project/${selectedSlug}. Changes stay in this browser draft until submitted together.`
            : 'Add a project to the browser draft. The URL slug cannot be changed after saving.'
        }
        steps={[
          {
            label: 'Details',
            content: (
              <fieldset className="cms-editor-form-group" disabled={pending}>
                {!selectedSlug && (
                  <label className="cms-editor-field cms-editor-slug-field">
                    <span>Project URL slug</span>
                    <input
                      ref={slugInput}
                      name="slug"
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
                      aria-describedby={
                        formState.errors.title ? 'cms-project-title-error' : undefined
                      }
                      required
                    />
                    <FieldError
                      id="cms-project-title-error"
                      message={formState.errors.title?.message}
                    />
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
                      aria-describedby={
                        formState.errors.year ? 'cms-project-year-error' : undefined
                      }
                    />
                    <FieldError
                      id="cms-project-year-error"
                      message={formState.errors.year?.message}
                    />
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
                      aria-describedby={
                        formState.errors.sortOrder ? 'cms-project-sort-error' : undefined
                      }
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
                  Unpublished project files and their Git history remain public in the content
                  repository. This setting only controls whether the project appears on the
                  portfolio site.
                </p>
              </fieldset>
            ),
          },
          {
            label: 'Organization',
            content: (
              <fieldset className="cms-editor-form-group" disabled={pending}>
                <fieldset
                  className="cms-editor-choice-group"
                  aria-invalid={Boolean(categoryError)}
                  aria-describedby={categoryError ? 'cms-project-categories-error' : undefined}
                >
                  <legend>Categories</legend>
                  <Controller
                    control={control}
                    name="categories"
                    render={({ field }) => {
                      const selected = field.value || [];
                      const available = categories.filter(([id]) => !selected.includes(id));

                      return (
                        <>
                          <label className="cms-editor-field">
                            <span>Add a category</span>
                            <Select
                              aria-label="Add a category"
                              ref={(element) => {
                                field.ref(element);
                                categorySelect.current = element;
                              }}
                              name={field.name}
                              value=""
                              onBlur={field.onBlur}
                              onValueChange={(id) => {
                                if (id) {
                                  field.onChange([...selected, id]);
                                }
                              }}
                              placeholder="Choose a category…"
                              aria-invalid={Boolean(categoryError)}
                              aria-describedby={
                                categoryError ? 'cms-project-categories-error' : undefined
                              }
                              options={available.map(([id, category]) => ({
                                value: id,
                                label: category.label,
                              }))}
                            />
                          </label>
                          {selected.length ? (
                            <ul className="cms-editor-chip-list" aria-label="Selected categories">
                              {selected.map((id) => {
                                const label = snapshot.categories.data[id]?.label || id;
                                return (
                                  <li className="cms-editor-chip" key={id}>
                                    <span className="cms-editor-chip-label">{label}</span>
                                    <button
                                      className="cms-editor-chip-remove"
                                      type="button"
                                      aria-label={`Remove category ${label}`}
                                      onClick={() => {
                                        field.onChange(
                                          selected.filter((selectedId) => selectedId !== id),
                                        );
                                        categorySelect.current?.focus();
                                      }}
                                    >
                                      <span aria-hidden="true">×</span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="cms-editor-hint">No categories selected.</p>
                          )}
                          {!categories.length && (
                            <p className="cms-editor-hint">
                              Add and save a category before assigning one to a project.
                            </p>
                          )}
                        </>
                      );
                    }}
                  />
                  <FieldError id="cms-project-categories-error" message={categoryError} />
                </fieldset>

                <fieldset
                  className="cms-editor-choice-group"
                  aria-invalid={Boolean(techError)}
                  aria-describedby={techError ? 'cms-project-technologies-error' : undefined}
                >
                  <legend>Technologies</legend>
                  <Controller
                    control={control}
                    name="technologies"
                    render={({ field }) => {
                      const selected = field.value || [];
                      const available = technologies.filter(([id]) => !selected.includes(id));

                      return (
                        <>
                          <label className="cms-editor-field">
                            <span>Add a technology</span>
                            <Select
                              aria-label="Add a technology"
                              ref={(element) => {
                                field.ref(element);
                                technologySelect.current = element;
                              }}
                              name={field.name}
                              value=""
                              onBlur={field.onBlur}
                              onValueChange={(id) => {
                                if (id) {
                                  field.onChange([...selected, id]);
                                }
                              }}
                              placeholder="Choose a technology…"
                              aria-invalid={Boolean(techError)}
                              aria-describedby={
                                techError ? 'cms-project-technologies-error' : undefined
                              }
                              options={available.map(([id, technology]) => ({
                                value: id,
                                label: technology.label,
                              }))}
                            />
                          </label>
                          {selected.length ? (
                            <ul className="cms-editor-chip-list" aria-label="Selected technologies">
                              {selected.map((id) => {
                                const label = snapshot.technologies.data[id]?.label || id;
                                return (
                                  <li className="cms-editor-chip" key={id}>
                                    <span className="cms-editor-chip-label">{label}</span>
                                    <button
                                      className="cms-editor-chip-remove"
                                      type="button"
                                      aria-label={`Remove technology ${label}`}
                                      onClick={() => {
                                        field.onChange(
                                          selected.filter((selectedId) => selectedId !== id),
                                        );
                                        technologySelect.current?.focus();
                                      }}
                                    >
                                      <span aria-hidden="true">×</span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="cms-editor-hint">No technologies selected.</p>
                          )}
                          {!technologies.length && (
                            <p className="cms-editor-hint">
                              Add and save a technology before assigning one to a project.
                            </p>
                          )}
                        </>
                      );
                    }}
                  />
                  <FieldError id="cms-project-technologies-error" message={techError} />
                </fieldset>

                <fieldset
                  className="cms-editor-choice-group cms-editor-tag-group"
                  aria-invalid={Boolean(tagsError)}
                  aria-describedby={tagsError ? 'cms-project-tags-error' : undefined}
                >
                  <legend>Tags</legend>
                  <Controller
                    control={control}
                    name="tags"
                    render={({ field }) => {
                      const storedTags = field.value || [];
                      const hasDraftTag = tagDraft.length > 0 && storedTags.at(-1) === tagDraft;
                      const tags = hasDraftTag ? storedTags.slice(0, -1) : storedTags;
                      const canAddTag = tagDraft.trim().length > 0 && tags.length < 30;

                      return (
                        <>
                          {tags.length ? (
                            <ul className="cms-editor-chip-list" aria-label="Project tags">
                              {tags.map((tag, index) => (
                                <li className="cms-editor-chip" key={`${tag}-${index}`}>
                                  <span className="cms-editor-chip-label">{tag}</span>
                                  <button
                                    className="cms-editor-chip-remove"
                                    type="button"
                                    aria-label={`Remove tag ${tag}`}
                                    onClick={() => {
                                      const nextTags = tags.filter(
                                        (_, tagIndex) => tagIndex !== index,
                                      );
                                      field.onChange(
                                        hasDraftTag ? [...nextTags, tagDraft] : nextTags,
                                      );
                                      tagInput.current?.focus();
                                    }}
                                  >
                                    <span aria-hidden="true">×</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="cms-editor-hint">No tags added.</p>
                          )}
                          <div className="cms-editor-add-row cms-editor-tag-add-row">
                            <label className="cms-editor-field">
                              <span>Add a tag</span>
                              <input
                                ref={(element) => {
                                  field.ref(element);
                                  tagInput.current = element;
                                }}
                                name={field.name}
                                value={tagDraft}
                                onBlur={field.onBlur}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (value && tags.length >= 30) {
                                    return;
                                  }
                                  field.onChange(value ? [...tags, value] : tags);
                                  setTagDraft(value);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    if (canAddTag) {
                                      setTagDraft('');
                                    }
                                  }
                                }}
                                maxLength={40}
                                readOnly={tags.length >= 30 && !hasDraftTag}
                                aria-invalid={Boolean(tagsError)}
                                aria-describedby={
                                  tagsError ? 'cms-project-tags-error' : 'cms-project-tags-hint'
                                }
                              />
                            </label>
                            <Button
                              kind="action"
                              variant="outline"
                              type="button"
                              onClick={() => {
                                if (canAddTag) {
                                  setTagDraft('');
                                }
                              }}
                              disabled={!canAddTag}
                            >
                              Add tag
                            </Button>
                          </div>
                          <p className="cms-editor-hint" id="cms-project-tags-hint">
                            {tags.length >= 30 && !hasDraftTag
                              ? 'Remove a tag to add another. Use up to 30 tags.'
                              : 'Press Enter or select Add tag. Use up to 30 tags.'}
                          </p>
                        </>
                      );
                    }}
                  />
                  <FieldError id="cms-project-tags-error" message={tagsError} />
                </fieldset>
              </fieldset>
            ),
          },
          {
            label: 'Links and media',
            content: (
              <fieldset className="cms-editor-form-group" disabled={pending}>
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
                    aria-describedby={
                      coverError ? 'cms-project-cover-error' : 'cms-project-cover-hint'
                    }
                    required
                  />
                  <FieldError id="cms-project-cover-error" message={coverError} />
                  <span className="cms-editor-hint" id="cms-project-cover-hint">
                    Use a project image uploaded from the Images section.
                  </span>
                </label>

                <label className="cms-editor-field">
                  <span>
                    Gallery image paths{' '}
                    <span className="cms-editor-hint-inline">(one per line)</span>
                  </span>
                  <Controller
                    control={control}
                    name="media.gallery"
                    render={({ field }) => (
                      <textarea
                        ref={field.ref}
                        name={field.name}
                        value={(field.value || []).join('\n')}
                        onBlur={(event) => {
                          field.onChange(
                            event.target.value
                              .split('\n')
                              .map((path) => path.trim())
                              .filter(Boolean),
                          );
                          field.onBlur();
                        }}
                        onChange={(event) => field.onChange(event.target.value.split('\n'))}
                        rows={2}
                        aria-invalid={Boolean(galleryMessage)}
                        aria-describedby={galleryMessage ? 'cms-project-gallery-error' : undefined}
                      />
                    )}
                  />
                  <FieldError id="cms-project-gallery-error" message={galleryMessage} />
                </label>
                {selectedSlug && allowDelete && (
                  <Button
                    kind="action"
                    className="cms-editor-danger-button"
                    type="button"
                    onClick={() => {
                      void onDelete().then((removed) => {
                        if (removed) {
                          setDialogOpen(false);
                        }
                      });
                    }}
                    disabled={pending}
                  >
                    Delete project
                  </Button>
                )}
              </fieldset>
            ),
          },
        ]}
        activeStep={activeStep}
        onStepChange={setActiveStep}
        onNext={validateStep}
        onSubmit={submit}
        onChange={() => {
          setFocusFieldName(undefined);
          onClearMessage();
        }}
        pending={pending}
        submitLabel={selectedSlug ? 'Save project draft' : 'Add project to draft'}
        focusFieldName={focusFieldName}
        feedback={dialogOpen ? feedback : undefined}
      />
      {!dialogOpen && feedback}

      {formState.isDirty && (
        <p className="cms-editor-draft-state">Project changes are in your browser draft.</p>
      )}
    </section>
  );
}
