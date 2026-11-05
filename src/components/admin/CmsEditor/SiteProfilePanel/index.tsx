import { useState } from 'react';
import { Button } from '@/components/common/Button';
import { useFieldArray, useWatch } from 'react-hook-form';
import { InlineSiteProfileWizard } from './InlineSiteProfileWizard';
import { FieldError } from '../FieldError';
import type { SiteProfilePanelProps } from './type';
import './style.css';

const detailFields = ['siteTitle', 'headline', 'introduction'] as const;

export function SiteProfilePanel({
  form,
  projects,
  active,
  pending,
  feedback,
  onSave,
  onClearMessage,
}: SiteProfilePanelProps) {
  const { register, control, formState } = form;
  const links = useFieldArray({ control, name: 'socialLinks' });
  const heroProjectSlugs = useWatch({ control, name: 'heroProjectSlugs' });
  const [step, setStep] = useState(0);
  const [focusFieldName, setFocusFieldName] = useState<string>();
  const orderedProjects = [...projects].sort(
    (left, right) =>
      left.data.sortOrder - right.data.sortOrder || left.slug.localeCompare(right.slug),
  );
  const defaultHeroProjectSlugs = orderedProjects
    .filter(({ data }) => data.published && data.featured)
    .slice(0, 3)
    .map(({ slug }) => slug);
  const selectedHeroProjectSlugs = heroProjectSlugs ?? defaultHeroProjectSlugs;
  const projectsBySlug = new Map(orderedProjects.map((project) => [project.slug, project]));

  function updateHeroProjectSelection(slugs: string[]) {
    form.setValue('heroProjectSlugs', slugs, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    onClearMessage();
  }

  function toggleHeroProject(slug: string) {
    if (selectedHeroProjectSlugs.includes(slug)) {
      updateHeroProjectSelection(selectedHeroProjectSlugs.filter((selected) => selected !== slug));
    } else if (selectedHeroProjectSlugs.length < 3) {
      updateHeroProjectSelection([...selectedHeroProjectSlugs, slug]);
    }
  }

  function moveHeroProject(index: number, offset: -1 | 1) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= selectedHeroProjectSlugs.length) {
      return;
    }

    const next = [...selectedHeroProjectSlugs];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    updateHeroProjectSelection(next);
  }

  return (
    <section
      id="cms-editor-site-panel"
      className="cms-editor-panel cms-editor-site-panel"
      aria-labelledby="cms-site-heading"
      hidden={!active}
    >
      <div className="cms-editor-panel-heading">
        <div>
          <p className="eyebrow">Site-wide copy</p>
          <h2 id="cms-site-heading">Site Profile</h2>
        </div>
      </div>
      <InlineSiteProfileWizard
        title="Edit site profile"
        description="Changes stay in your browser draft until you submit all changes."
        activeStep={step}
        onStepChange={(nextStep) => {
          setFocusFieldName(undefined);
          setStep(nextStep);
        }}
        onNext={() => {
          if (step === 0) {
            return form.trigger([...detailFields], { shouldFocus: true });
          }
          if (step === 1) {
            return form.trigger(['socialLinks'], { shouldFocus: true });
          }
          return form.trigger(['heroProjectSlugs'], { shouldFocus: true });
        }}
        onSubmit={form.handleSubmit(onSave, (errors) => {
          const firstInvalid = detailFields.find((field) => errors[field]);
          if (firstInvalid) {
            setFocusFieldName(firstInvalid);
            setStep(0);
          } else if (errors.socialLinks) {
            setFocusFieldName(undefined);
            setStep(1);
          } else if (errors.heroProjectSlugs) {
            setFocusFieldName('heroProjectSlugs');
            setStep(2);
          }
        })}
        onChange={onClearMessage}
        pending={pending}
        submitLabel="Save site profile draft"
        focusFieldName={focusFieldName}
        feedback={feedback}
        steps={[
          {
            label: 'Site details',
            content: (
              <fieldset className="cms-editor-form-group" disabled={pending}>
                <div className="cms-editor-grid">
                  <label className="cms-editor-field">
                    <span>Site title</span>
                    <input
                      {...register('siteTitle')}
                      maxLength={120}
                      aria-invalid={Boolean(formState.errors.siteTitle)}
                      aria-describedby={
                        formState.errors.siteTitle ? 'cms-site-title-error' : undefined
                      }
                      required
                    />
                    <FieldError
                      id="cms-site-title-error"
                      message={formState.errors.siteTitle?.message}
                    />
                  </label>
                  <label className="cms-editor-field">
                    <span>Headline</span>
                    <input
                      {...register('headline')}
                      maxLength={240}
                      aria-invalid={Boolean(formState.errors.headline)}
                      aria-describedby={
                        formState.errors.headline ? 'cms-site-headline-error' : undefined
                      }
                      required
                    />
                    <FieldError
                      id="cms-site-headline-error"
                      message={formState.errors.headline?.message}
                    />
                  </label>
                </div>
                <label className="cms-editor-field">
                  <span>Introduction</span>
                  <textarea
                    {...register('introduction')}
                    rows={4}
                    maxLength={5_000}
                    aria-invalid={Boolean(formState.errors.introduction)}
                    aria-describedby={
                      formState.errors.introduction ? 'cms-site-introduction-error' : undefined
                    }
                    required
                  />
                  <FieldError
                    id="cms-site-introduction-error"
                    message={formState.errors.introduction?.message}
                  />
                </label>
              </fieldset>
            ),
          },
          {
            label: 'Social links',
            content: (
              <fieldset className="cms-editor-form-group" disabled={pending}>
                <fieldset
                  className="cms-editor-choice-group"
                  aria-invalid={Boolean(formState.errors.socialLinks)}
                  aria-describedby={
                    formState.errors.socialLinks?.message
                      ? 'cms-site-social-links-error'
                      : undefined
                  }
                >
                  <legend>Social links</legend>
                  <div className="cms-editor-stack">
                    {links.fields.map((link, index) => (
                      <div className="cms-editor-repeat-row cms-editor-social-row" key={link.id}>
                        <label className="cms-editor-field">
                          <span>Link label</span>
                          <input
                            {...register(`socialLinks.${index}.label`)}
                            maxLength={60}
                            aria-invalid={Boolean(formState.errors.socialLinks?.[index]?.label)}
                            aria-describedby={
                              formState.errors.socialLinks?.[index]?.label
                                ? `cms-site-social-label-${index}-error`
                                : undefined
                            }
                          />
                          <FieldError
                            id={`cms-site-social-label-${index}-error`}
                            message={formState.errors.socialLinks?.[index]?.label?.message}
                          />
                        </label>
                        <label className="cms-editor-field">
                          <span>HTTPS URL</span>
                          <input
                            type="url"
                            {...register(`socialLinks.${index}.url`)}
                            placeholder="https://…"
                            aria-invalid={Boolean(formState.errors.socialLinks?.[index]?.url)}
                            aria-describedby={
                              formState.errors.socialLinks?.[index]?.url
                                ? `cms-site-social-url-${index}-error`
                                : undefined
                            }
                          />
                          <FieldError
                            id={`cms-site-social-url-${index}-error`}
                            message={formState.errors.socialLinks?.[index]?.url?.message}
                          />
                        </label>
                        <button
                          type="button"
                          className="cms-editor-remove-button"
                          onClick={() => {
                            links.remove(index);
                            onClearMessage();
                          }}
                          aria-label={`Remove ${link.label || `social link ${index + 1}`}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    kind="action"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      links.append({ label: '', url: '' });
                      onClearMessage();
                    }}
                  >
                    Add social link
                  </Button>
                  <FieldError
                    id="cms-site-social-links-error"
                    message={formState.errors.socialLinks?.message}
                  />
                </fieldset>
                {formState.isDirty && (
                  <p className="cms-editor-draft-state">
                    Site profile changes are in your browser draft.
                  </p>
                )}
              </fieldset>
            ),
          },
          {
            label: 'Hero highlights',
            content: (
              <fieldset className="cms-editor-form-group" disabled={pending}>
                <fieldset
                  className="cms-editor-choice-group cms-editor-hero-projects"
                  aria-invalid={Boolean(formState.errors.heroProjectSlugs)}
                  aria-describedby="cms-site-hero-projects-help cms-site-hero-projects-error"
                >
                  <legend>Homepage hero projects</legend>
                  <p id="cms-site-hero-projects-help" className="cms-editor-hint">
                    Choose up to three published projects. The hero presents them in the order
                    selected below. Until a selection is saved, it uses the first three featured
                    published projects by project order.
                  </p>
                  <p className="cms-editor-draft-state" aria-live="polite">
                    {selectedHeroProjectSlugs.length} of 3 selected
                  </p>
                  {orderedProjects.length === 0 && (
                    <p className="cms-editor-hint">
                      No projects are available yet. Add a project before selecting hero highlights.
                    </p>
                  )}
                  <div className="cms-editor-hero-choice-list">
                    {orderedProjects.map(({ slug, data }) => {
                      const selected = selectedHeroProjectSlugs.includes(slug);
                      return (
                        <label className="cms-editor-hero-choice" key={slug}>
                          <input
                            type="checkbox"
                            name="heroProjectSlugs"
                            checked={selected}
                            disabled={
                              !selected && (!data.published || selectedHeroProjectSlugs.length >= 3)
                            }
                            aria-invalid={Boolean(formState.errors.heroProjectSlugs)}
                            aria-describedby={
                              formState.errors.heroProjectSlugs
                                ? 'cms-site-hero-projects-error'
                                : undefined
                            }
                            onChange={() => toggleHeroProject(slug)}
                          />
                          <span className="cms-editor-hero-choice-copy">
                            <span>{data.title}</span>
                            <span className="cms-editor-hint">
                              {slug}
                              {!data.published && ' · Unpublished; remove it from the selection'}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <FieldError
                    id="cms-site-hero-projects-error"
                    message={formState.errors.heroProjectSlugs?.message}
                  />
                </fieldset>
                {selectedHeroProjectSlugs.length > 0 && (
                  <fieldset className="cms-editor-choice-group">
                    <legend>Selected order</legend>
                    <ol className="cms-editor-hero-order-list">
                      {selectedHeroProjectSlugs.map((slug, index) => {
                        const project = projectsBySlug.get(slug);
                        const label = project?.data.title ?? `Missing project: ${slug}`;
                        return (
                          <li className="cms-editor-hero-order" key={`${slug}-${index}`}>
                            <span>
                              <span className="cms-editor-hero-order-number">{index + 1}.</span>{' '}
                              {label}
                              {!project && (
                                <span className="cms-editor-hint">
                                  {' '}
                                  Remove this reference before submitting.
                                </span>
                              )}
                              {project && !project.data.published && (
                                <span className="cms-editor-hint">
                                  {' '}
                                  This project is unpublished; remove it or publish the project
                                  before submitting.
                                </span>
                              )}
                            </span>
                            <div className="cms-editor-actions">
                              <Button
                                kind="action"
                                type="button"
                                variant="outline"
                                aria-label={`Move earlier: ${label}`}
                                disabled={pending || index === 0}
                                onClick={() => moveHeroProject(index, -1)}
                              >
                                Move earlier
                              </Button>
                              <Button
                                kind="action"
                                type="button"
                                variant="outline"
                                aria-label={`Move later: ${label}`}
                                disabled={pending || index === selectedHeroProjectSlugs.length - 1}
                                onClick={() => moveHeroProject(index, 1)}
                              >
                                Move later
                              </Button>
                              <Button
                                kind="action"
                                type="button"
                                variant="outline"
                                className="cms-editor-danger-button"
                                aria-label={`Remove ${label} from hero highlights`}
                                disabled={pending}
                                onClick={() => toggleHeroProject(slug)}
                              >
                                Remove
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </fieldset>
                )}
                {formState.isDirty && (
                  <p className="cms-editor-draft-state">
                    Site profile changes are in your browser draft.
                  </p>
                )}
              </fieldset>
            ),
          },
        ]}
      />
    </section>
  );
}
