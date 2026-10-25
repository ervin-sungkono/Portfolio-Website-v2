import type { SiteProfilePanelProps } from './type';
import './style.css';
import { useFieldArray } from 'react-hook-form';
import type { FieldErrorProps } from '../type';
import { CmsMessage } from '../CmsMessage';

function FieldError({ id, message }: FieldErrorProps) {
  return message ? (
    <p className="cms-editor-field-error" id={id}>
      {message}
    </p>
  ) : null;
}

export function SiteProfilePanel({
  form,
  active,
  pending,
  message,
  onSave,
  onClearMessage,
  onReload,
  onRetry,
}: SiteProfilePanelProps) {
  const { register, control, formState } = form;
  const links = useFieldArray({ control, name: 'socialLinks' });

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
      <CmsMessage message={message} onReload={onReload} onRetry={onRetry} pending={pending} />
      <form
        className="cms-editor-form"
        onSubmit={form.handleSubmit(onSave)}
        onChange={onClearMessage}
        noValidate
      >
        <fieldset disabled={pending}>
          <div className="cms-editor-grid">
            <label className="cms-editor-field">
              <span>Site title</span>
              <input
                {...register('siteTitle')}
                maxLength={120}
                aria-invalid={Boolean(formState.errors.siteTitle)}
                aria-describedby={formState.errors.siteTitle ? 'cms-site-title-error' : undefined}
                required
              />
              <FieldError id="cms-site-title-error" message={formState.errors.siteTitle?.message} />
            </label>
            <label className="cms-editor-field">
              <span>Headline</span>
              <input
                {...register('headline')}
                maxLength={240}
                aria-invalid={Boolean(formState.errors.headline)}
                aria-describedby={formState.errors.headline ? 'cms-site-headline-error' : undefined}
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
              rows={6}
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

          <fieldset
            className="cms-editor-choice-group"
            aria-invalid={Boolean(formState.errors.socialLinks)}
            aria-describedby={
              formState.errors.socialLinks?.message ? 'cms-site-social-links-error' : undefined
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
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                links.append({ label: '', url: '' });
                onClearMessage();
              }}
            >
              Add social link
            </button>
            <FieldError
              id="cms-site-social-links-error"
              message={formState.errors.socialLinks?.message}
            />
          </fieldset>
        </fieldset>
        <div className="cms-editor-actions">
          <button className="button" type="submit" disabled={pending}>
            Save site profile
          </button>
          {formState.isDirty && (
            <span className="cms-editor-draft-state">Unsaved site profile changes</span>
          )}
        </div>
      </form>
    </section>
  );
}
