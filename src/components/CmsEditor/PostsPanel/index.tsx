import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import type { PostsPanelProps } from './type';
import { CmsMessage } from '../CmsMessage';
import './style.css';

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p className="cms-editor-field-error" id={id}>
      {message}
    </p>
  ) : null;
}

function slugIsValid(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function PostsPanel({
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
}: PostsPanelProps) {
  const { register, formState } = form;
  const slugInput = useRef<HTMLInputElement>(null);
  const [slugSubmitError, setSlugSubmitError] = useState('');
  const slugError = selectedSlug
    ? ''
    : newSlug && !slugIsValid(newSlug)
      ? 'Use lowercase letters, numbers, and single hyphens.'
      : newSlug
        ? ''
        : slugSubmitError;

  function submit(event: FormEvent<HTMLFormElement>) {
    onClearMessage();
    void form.handleSubmit(async (data) => {
      if (!selectedSlug && !slugIsValid(newSlug.trim())) {
        setSlugSubmitError(
          'Enter a post URL slug using lowercase letters, numbers, and single hyphens.',
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
      id="cms-editor-posts-panel"
      className="cms-editor-panel cms-editor-posts-panel"
      aria-labelledby="cms-posts-heading"
      hidden={!active}
    >
      <div className="cms-editor-panel-heading">
        <div>
          <p className="eyebrow">Content collection</p>
          <h2 id="cms-posts-heading">Blog Posts</h2>
        </div>
        <label className="cms-editor-field cms-editor-post-picker">
          <span>Choose a blog post</span>
          <select
            value={selectedSlug}
            disabled={pending}
            onChange={(event) => {
              setSlugSubmitError('');
              onSelectedSlugChange(event.target.value);
            }}
          >
            <option value="">New blog post</option>
            {snapshot.posts.map((post) => (
              <option value={post.slug} key={post.slug}>
                {post.data.title} ({post.slug})
              </option>
            ))}
          </select>
        </label>
      </div>

      <CmsMessage message={message} onReload={onReload} onRetry={onRetry} pending={pending} />

      <form className="cms-editor-form" onSubmit={submit} onChange={onClearMessage} noValidate>
        <fieldset disabled={pending}>
          {!selectedSlug ? (
            <label className="cms-editor-field cms-editor-slug-field">
              <span>Blog post URL slug</span>
              <input
                ref={slugInput}
                value={newSlug}
                onChange={(event) => {
                  setSlugSubmitError('');
                  onNewSlugChange(event.target.value.toLowerCase());
                }}
                autoComplete="off"
                maxLength={100}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                aria-invalid={Boolean(slugError)}
                aria-describedby={slugError ? 'cms-post-slug-error' : 'cms-post-slug-hint'}
                required
              />
              <FieldError id="cms-post-slug-error" message={slugError} />
              <span className="cms-editor-hint" id="cms-post-slug-hint">
                This becomes the public blog URL and cannot be changed after saving.
              </span>
            </label>
          ) : (
            <p className="cms-editor-post-slug">
              <strong>Blog post URL slug</strong> <code>{selectedSlug}</code>
            </p>
          )}

          <div className="cms-editor-grid">
            <label className="cms-editor-field">
              <span>Title</span>
              <input
                {...register('title')}
                maxLength={120}
                aria-invalid={Boolean(formState.errors.title)}
                aria-describedby={formState.errors.title ? 'cms-post-title-error' : undefined}
                required
              />
              <FieldError id="cms-post-title-error" message={formState.errors.title?.message} />
            </label>
            <label className="cms-editor-field">
              <span>Summary</span>
              <input
                {...register('summary')}
                maxLength={240}
                aria-invalid={Boolean(formState.errors.summary)}
                aria-describedby={formState.errors.summary ? 'cms-post-summary-error' : undefined}
                required
              />
              <FieldError id="cms-post-summary-error" message={formState.errors.summary?.message} />
            </label>
          </div>

          <label className="cms-editor-field cms-editor-post-date">
            <span>Publication date</span>
            <input
              type="date"
              {...register('publishedAt')}
              aria-invalid={Boolean(formState.errors.publishedAt)}
              aria-describedby={formState.errors.publishedAt ? 'cms-post-date-error' : undefined}
              required
            />
            <FieldError id="cms-post-date-error" message={formState.errors.publishedAt?.message} />
          </label>

          <label className="cms-editor-field">
            <span>Body</span>
            <textarea
              {...register('body')}
              rows={18}
              maxLength={30_000}
              aria-invalid={Boolean(formState.errors.body)}
              aria-describedby={
                formState.errors.body
                  ? 'cms-post-body-error cms-post-body-hint'
                  : 'cms-post-body-hint'
              }
              required
            />
            <FieldError id="cms-post-body-error" message={formState.errors.body?.message} />
            <span className="cms-editor-hint" id="cms-post-body-hint">
              Write in Markdown. Headings, paragraphs, lists, links, and code blocks are supported.
            </span>
          </label>

          <label className="cms-editor-checkbox">
            <input type="checkbox" {...register('published')} />
            <span>Published on the public site</span>
          </label>
        </fieldset>

        <div className="cms-editor-actions">
          <button className="button" type="submit" disabled={pending}>
            {selectedSlug ? 'Save blog post' : 'Create blog post'}
          </button>
          {selectedSlug && (
            <button
              className="button cms-editor-danger-button"
              type="button"
              onClick={onDelete}
              disabled={pending}
            >
              Delete blog post
            </button>
          )}
          {formState.isDirty && (
            <span className="cms-editor-draft-state">Unsaved blog post changes</span>
          )}
        </div>
      </form>
    </section>
  );
}
