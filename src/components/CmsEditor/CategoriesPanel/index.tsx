import type { CategoriesPanelProps } from './type';
import './style.css';
import { useState } from 'react';
import type { FieldPath } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import type { Categories } from '@/lib/cms/schemas';
import { CmsMessage } from '../CmsMessage';

const categoryIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function CategoriesPanel({
  form,
  active,
  pending,
  message,
  onSave,
  onClearMessage,
  onReload,
  onRetry,
}: CategoriesPanelProps) {
  const { control, register, getValues, getFieldState, reset, formState } = form;
  const categories = useWatch({ control }) || {};
  const categoryEntries = Object.entries(categories) as Array<[string, Categories[string]]>;
  const [newId, setNewId] = useState('');
  const [idError, setIdError] = useState('');

  function addCategory() {
    const id = newId.trim().toLowerCase();
    if (!categoryIdPattern.test(id)) {
      setIdError('Use lowercase letters, numbers, and single hyphens for the ID.');
      return;
    }
    if (Object.hasOwn(getValues(), id)) {
      setIdError('That category ID already exists.');
      return;
    }
    const highestOrder = Object.values(getValues()).reduce(
      (max, category) => Math.max(max, category.sortOrder),
      0,
    );
    reset(
      { ...getValues(), [id]: { label: '', sortOrder: highestOrder + 10 } },
      { keepDefaultValues: true },
    );
    setNewId('');
    setIdError('');
    onClearMessage();
  }

  function removeCategory(id: string) {
    const next = { ...getValues() };
    delete next[id];
    reset(next, { keepDefaultValues: true });
    onClearMessage();
  }

  return (
    <section
      id="cms-editor-categories-panel"
      className="cms-editor-panel cms-editor-category-panel"
      aria-labelledby="cms-categories-heading"
      hidden={!active}
    >
      <div className="cms-editor-panel-heading">
        <div>
          <p className="eyebrow">Project taxonomy</p>
          <h2 id="cms-categories-heading">Categories</h2>
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
          <p className="cms-editor-hint">
            IDs are stable references used by projects. Removing a category that a project still
            uses will be rejected when you save.
          </p>
          <div className="cms-editor-stack">
            {categoryEntries
              .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
              .map(([id, category]) => {
                const labelPath = `${id}.label` as FieldPath<Categories>;
                const orderPath = `${id}.sortOrder` as FieldPath<Categories>;
                const labelError = getFieldState(labelPath).error?.message;
                const orderError = getFieldState(orderPath).error?.message;
                return (
                  <div className="cms-editor-repeat-row cms-editor-category-row" key={id}>
                    <div className="cms-editor-field cms-editor-id-field">
                      <span>ID</span>
                      <code>{id}</code>
                    </div>
                    <label className="cms-editor-field">
                      <span>Label</span>
                      <input
                        {...register(labelPath)}
                        maxLength={80}
                        aria-invalid={Boolean(labelError)}
                        aria-describedby={labelError ? `cms-category-${id}-label-error` : undefined}
                      />
                      {labelError && (
                        <p className="cms-editor-field-error" id={`cms-category-${id}-label-error`}>
                          {labelError}
                        </p>
                      )}
                    </label>
                    <label className="cms-editor-field cms-editor-order-field">
                      <span>Sort order</span>
                      <input
                        type="number"
                        min={0}
                        max={100_000}
                        step={1}
                        {...register(orderPath, { valueAsNumber: true })}
                        aria-invalid={Boolean(orderError)}
                        aria-describedby={orderError ? `cms-category-${id}-order-error` : undefined}
                      />
                      {orderError && (
                        <p className="cms-editor-field-error" id={`cms-category-${id}-order-error`}>
                          {orderError}
                        </p>
                      )}
                    </label>
                    <button
                      type="button"
                      className="cms-editor-remove-button"
                      onClick={() => removeCategory(id)}
                      aria-label={`Remove category ${category.label || id}`}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
          </div>
          <div className="cms-editor-add-row">
            <label className="cms-editor-field">
              <span>New category ID</span>
              <input
                value={newId}
                onChange={(event) => {
                  setNewId(event.target.value);
                  setIdError('');
                }}
                autoComplete="off"
                maxLength={80}
                aria-invalid={Boolean(idError)}
                aria-describedby={idError ? 'cms-new-category-error' : 'cms-new-category-help'}
              />
              {idError && (
                <p className="cms-editor-field-error" id="cms-new-category-error">
                  {idError}
                </p>
              )}
              {!idError && (
                <span className="cms-editor-hint" id="cms-new-category-help">
                  Use a short, lowercase ID such as “web”.
                </span>
              )}
            </label>
            <button type="button" className="button button-outline" onClick={addCategory}>
              Add category
            </button>
          </div>
        </fieldset>
        <div className="cms-editor-actions">
          <button className="button" type="submit" disabled={pending}>
            Save categories
          </button>
          {formState.isDirty && (
            <span className="cms-editor-draft-state">Unsaved category changes</span>
          )}
        </div>
      </form>
    </section>
  );
}
