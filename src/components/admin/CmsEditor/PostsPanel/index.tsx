'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/common/Button';
import { CmsWizardDialog } from '../../CmsWizardDialog';
import { FieldError } from '../FieldError';
import type { PostsPanelProps } from './type';
import './style.css';

const MarkdownEditor = dynamic(() => import('./MarkdownEditor'), {
  ssr: false,
  loading: () => <p role="status">Loading Markdown editor…</p>,
});

export function PostsPanel({
  form,
  snapshot,
  active,
  selectedSlug,
  newSlug,
  pending,
  feedback,
  onSelectedSlugChange,
  onNewSlugChange,
  onSave,
  onDelete,
  onClearMessage,
}: PostsPanelProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [slugError, setSlugError] = useState('');
  const [switching, setSwitching] = useState(false);
  const [focusFieldName, setFocusFieldName] = useState<string>();
  const { register, control, formState } = form;

  async function edit(slug: string) {
    if (switching) {
      return;
    }
    setSwitching(true);
    try {
      if (await onSelectedSlugChange(slug)) {
        setStep(0);
        setSlugError('');
        setFocusFieldName(undefined);
        setOpen(true);
      }
    } finally {
      setSwitching(false);
    }
  }

  async function validateDetails() {
    if (
      !selectedSlug &&
      (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug.trim()) || newSlug.trim().length > 100)
    ) {
      setSlugError('Use lowercase letters, numbers, and single hyphens for the URL slug.');
      setFocusFieldName('postSlug');
      return false;
    }
    return form.trigger(['title', 'summary', 'publishedAt'], { shouldFocus: true });
  }

  return (
    <section
      id="cms-editor-posts-panel"
      className="cms-editor-panel cms-editor-posts-panel"
      aria-labelledby="cms-posts-heading"
      hidden={!active}
    >
      <div className="cms-editor-panel-heading">
        <h2 id="cms-posts-heading">Blog Posts</h2>
        <Button
          kind="action"
          type="button"
          onClick={() => void edit('')}
          disabled={pending || switching}
        >
          Add post
        </Button>
      </div>
      {!open && feedback}
      <div className="cms-editor-overview-table-wrap">
        <table className="cms-editor-overview-table" aria-label="Current blog posts">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Date</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(snapshot.posts ?? []).map((post) => (
              <tr key={post.slug}>
                <th scope="row">
                  {post.data.title || post.slug}
                  <small className="cms-post-slug">{post.slug}</small>
                </th>
                <td>{post.data.publishedAt}</td>
                <td>{post.data.published ? 'Published' : 'Draft'}</td>
                <td>
                  <div className="cms-editor-actions">
                    <Button
                      kind="action"
                      variant="outline"
                      type="button"
                      disabled={pending || switching}
                      aria-label={`Edit post ${post.data.title}`}
                      onClick={() => void edit(post.slug)}
                    >
                      Edit
                    </Button>
                    <Button
                      kind="action"
                      variant="outline"
                      type="button"
                      className="cms-editor-danger-button"
                      disabled={pending || switching}
                      aria-label={`Delete post ${post.data.title}`}
                      onClick={() => void onDelete(post.slug)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!snapshot.posts?.length && (
              <tr>
                <td colSpan={4}>No blog posts yet. Add a post to start writing.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <CmsWizardDialog
        open={open}
        onClose={() => setOpen(false)}
        title={selectedSlug ? 'Edit blog post' : 'Add blog post'}
        description="Changes stay in this browser until you submit the draft. Committed drafts are public in GitHub history."
        activeStep={step}
        onStepChange={setStep}
        onNext={validateDetails}
        pending={pending || switching}
        focusFieldName={focusFieldName}
        feedback={feedback}
        submitLabel="Save post draft"
        onChange={onClearMessage}
        onSubmit={(event) => {
          void form.handleSubmit(onSave, () => {
            if (
              form.formState.errors.title ||
              form.formState.errors.summary ||
              form.formState.errors.publishedAt
            ) {
              setStep(0);
            } else {
              setStep(1);
              setFocusFieldName('body');
            }
          })(event);
        }}
        steps={[
          {
            label: 'Post details',
            content: (
              <>
                {!selectedSlug ? (
                  <label className="cms-editor-field">
                    <span>Blog post URL slug</span>
                    <input
                      name="postSlug"
                      value={newSlug}
                      maxLength={100}
                      aria-invalid={Boolean(slugError)}
                      aria-describedby={slugError ? 'cms-post-slug-error' : undefined}
                      onChange={(event) => {
                        setSlugError('');
                        onNewSlugChange(event.target.value.toLowerCase());
                      }}
                    />
                    <FieldError id="cms-post-slug-error" message={slugError} />
                  </label>
                ) : (
                  <p>
                    URL: <code>/blog/{selectedSlug}</code>
                  </p>
                )}
                <label className="cms-editor-field">
                  <span>Title</span>
                  <input
                    {...register('title')}
                    maxLength={120}
                    aria-invalid={Boolean(formState.errors.title)}
                    aria-describedby={formState.errors.title ? 'cms-post-title-error' : undefined}
                  />
                  <FieldError id="cms-post-title-error" message={formState.errors.title?.message} />
                </label>
                <label className="cms-editor-field">
                  <span>Summary</span>
                  <textarea
                    {...register('summary')}
                    maxLength={240}
                    rows={3}
                    aria-invalid={Boolean(formState.errors.summary)}
                    aria-describedby={
                      formState.errors.summary ? 'cms-post-summary-error' : undefined
                    }
                  />
                  <FieldError
                    id="cms-post-summary-error"
                    message={formState.errors.summary?.message}
                  />
                </label>
                <label className="cms-editor-field">
                  <span>Publication date</span>
                  <input
                    type="date"
                    {...register('publishedAt')}
                    aria-invalid={Boolean(formState.errors.publishedAt)}
                    aria-describedby={
                      formState.errors.publishedAt ? 'cms-post-date-error' : 'cms-post-date-hint'
                    }
                  />
                  <span className="cms-editor-hint" id="cms-post-date-hint">
                    An editorial date. Visibility is controlled by the Published checkbox; this does
                    not schedule publication.
                  </span>
                  <FieldError
                    id="cms-post-date-error"
                    message={formState.errors.publishedAt?.message}
                  />
                </label>
                <label className="cms-editor-checkbox">
                  <input type="checkbox" {...register('published')} />
                  <span>Published on the public site</span>
                </label>
              </>
            ),
          },
          {
            label: 'Markdown content',
            content: (
              <div className="cms-post-content">
                <p className="cms-editor-hint" id="cms-post-body-hint">
                  Write GitHub Flavored Markdown. Tables, task checklists, links, strikethrough, and
                  fenced code blocks are supported. Tab moves to the next control.
                </p>
                {open && step === 1 && (
                  <Controller
                    name="body"
                    control={control}
                    render={({ field }) => (
                      <MarkdownEditor
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        invalid={Boolean(formState.errors.body)}
                        describedBy={
                          formState.errors.body
                            ? 'cms-post-body-error cms-post-body-hint'
                            : 'cms-post-body-hint'
                        }
                      />
                    )}
                  />
                )}
                <FieldError id="cms-post-body-error" message={formState.errors.body?.message} />
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
