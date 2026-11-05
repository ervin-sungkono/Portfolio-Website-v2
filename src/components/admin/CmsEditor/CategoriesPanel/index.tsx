import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { FieldPath } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Select';
import type { Categories } from '@/lib/cms/schemas';
import { useConfirmDialog } from '../../ConfirmDialog';
import { CmsWizardDialog } from '../../CmsWizardDialog';
import type { CategoriesPanelProps } from './type';
import './style.css';

const categoryIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function CategoriesPanel({
  form,
  active,
  pending,
  feedback,
  onSave,
  onClearMessage,
}: CategoriesPanelProps) {
  const { control, register, getValues, getFieldState, reset, formState } = form;
  const { confirm, confirmationDialog } = useConfirmDialog();
  const categories = useWatch({ control }) || {};
  const categoryEntries = Object.entries(categories) as Array<[string, Categories[string]]>;
  const [newId, setNewId] = useState('');
  const [idError, setIdError] = useState('');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [focusFieldName, setFocusFieldName] = useState<string>();
  const newIdInput = useRef<HTMLInputElement>(null);
  const currentId = Object.hasOwn(categories, selectedId) ? selectedId : categoryEntries[0]?.[0];

  function addCategory() {
    const id = newId.trim().toLowerCase();
    if (!categoryIdPattern.test(id)) {
      setIdError('Use lowercase letters, numbers, and single hyphens for the ID.');
      newIdInput.current?.focus();
      return;
    }
    if (Object.hasOwn(getValues(), id)) {
      setIdError('That category ID already exists.');
      newIdInput.current?.focus();
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
    setSelectedId(id);
    setFocusFieldName(`${id}.label`);
    setStep(0);
    onClearMessage();
  }

  function removeCategory(id: string) {
    const next = { ...getValues() };
    delete next[id];
    reset(next, { keepDefaultValues: true });
    onClearMessage();
  }

  function editCategory(id: string) {
    setSelectedId(id);
    setStep(0);
    setFocusFieldName(undefined);
    setOpen(true);
  }

  async function confirmRemoveCategory(id: string) {
    const category = getValues()[id];
    if (!category) {
      return;
    }
    if (
      await confirm({
        title: `Remove ${category.label || id}?`,
        description:
          'This removes the category from your browser draft. Projects that still reference it must be updated before submission.',
        confirmLabel: 'Remove category',
        danger: true,
      })
    ) {
      removeCategory(id);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    if (newId.trim()) {
      event.preventDefault();
      setIdError('Add this category or clear the ID before saving.');
      newIdInput.current?.focus();
      return;
    }
    void form.handleSubmit(onSave, (errors) => {
      const id = Object.keys(errors)[0];
      if (id) {
        const field = errors[id]?.label ? 'label' : 'sortOrder';
        setSelectedId(id);
        setFocusFieldName(`${id}.${field}`);
        setStep(0);
      }
    })(event);
  }

  async function validateCategories() {
    const valid = await form.trigger();
    if (!valid) {
      const invalid = categoryEntries.find(([id]) =>
        ['label', 'sortOrder'].some(
          (field) => getFieldState(`${id}.${field}` as FieldPath<Categories>).error,
        ),
      );
      if (invalid) {
        const [id] = invalid;
        const field = getFieldState(`${id}.label` as FieldPath<Categories>).error
          ? 'label'
          : 'sortOrder';
        if (id === currentId) {
          form.setFocus(`${id}.${field}` as FieldPath<Categories>);
        }
        setSelectedId(id);
        setFocusFieldName(`${id}.${field}`);
      }
    }
    return valid;
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
      {!open && feedback}
      <div className="cms-editor-overview-table-wrap">
        <table className="cms-editor-overview-table" aria-label="Current categories">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Label</th>
              <th scope="col">Sort order</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categoryEntries
              .slice()
              .sort(([, left], [, right]) => left.sortOrder - right.sortOrder)
              .map(([id, category]) => (
                <tr key={id}>
                  <th scope="row">{id}</th>
                  <td>{category.label || '—'}</td>
                  <td>{category.sortOrder}</td>
                  <td>
                    <div className="cms-editor-overview-actions">
                      <Button
                        kind="action"
                        type="button"
                        variant="outline"
                        onClick={() => editCategory(id)}
                        disabled={pending}
                      >
                        Edit
                      </Button>
                      <Button
                        kind="action"
                        type="button"
                        variant="outline"
                        className="cms-editor-danger-button"
                        onClick={() => void confirmRemoveCategory(id)}
                        disabled={pending}
                        aria-label={`Remove category ${category.label || id}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            {categoryEntries.length === 0 && (
              <tr>
                <td colSpan={4}>No categories are configured.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button
        kind="action"
        type="button"
        disabled={pending}
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
      >
        Edit categories
      </Button>
      <CmsWizardDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit categories"
        description="Changes stay in your browser draft until you submit all changes."
        activeStep={step}
        onStepChange={(nextStep) => {
          setFocusFieldName(undefined);
          setStep(nextStep);
        }}
        onNext={validateCategories}
        onSubmit={submit}
        onChange={onClearMessage}
        pending={pending}
        submitLabel="Save categories draft"
        focusFieldName={focusFieldName}
        feedback={open ? feedback : null}
        steps={[
          {
            label: 'Edit categories',
            content: (
              <fieldset className="cms-editor-form-group" disabled={pending}>
                <p className="cms-editor-hint">
                  IDs are stable references used by projects. Removing a category that a project
                  still uses will be rejected when you save.
                </p>
                {categoryEntries.length > 0 ? (
                  <label className="cms-editor-field">
                    <span>Choose a category</span>
                    <Select
                      aria-label="Choose a category"
                      value={currentId ?? ''}
                      onValueChange={(value) => {
                        setSelectedId(value);
                        setFocusFieldName(undefined);
                      }}
                      options={categoryEntries
                        .slice()
                        .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
                        .map(([id, category]) => ({
                          value: id,
                          label: category.label || id,
                        }))}
                    />
                  </label>
                ) : (
                  <p className="cms-editor-hint">No categories yet. Continue to add one.</p>
                )}
                <div className="cms-editor-stack">
                  {categoryEntries
                    .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
                    .map(([id, category]) => {
                      const labelPath = `${id}.label` as FieldPath<Categories>;
                      const orderPath = `${id}.sortOrder` as FieldPath<Categories>;
                      const labelError = getFieldState(labelPath).error?.message;
                      const orderError = getFieldState(orderPath).error?.message;
                      return (
                        <div
                          className="cms-editor-repeat-row cms-editor-category-row"
                          key={id}
                          hidden={id !== currentId}
                        >
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
                              aria-describedby={
                                labelError ? `cms-category-${id}-label-error` : undefined
                              }
                            />
                            {labelError && (
                              <p
                                className="cms-editor-field-error"
                                id={`cms-category-${id}-label-error`}
                              >
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
                              aria-describedby={
                                orderError ? `cms-category-${id}-order-error` : undefined
                              }
                            />
                            {orderError && (
                              <p
                                className="cms-editor-field-error"
                                id={`cms-category-${id}-order-error`}
                              >
                                {orderError}
                              </p>
                            )}
                          </label>
                          <button
                            type="button"
                            className="cms-editor-remove-button"
                            onClick={() => void confirmRemoveCategory(id)}
                            aria-label={`Remove category ${category.label || id}`}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                </div>
              </fieldset>
            ),
          },
          {
            label: 'Add category',
            content: (
              <fieldset className="cms-editor-form-group" disabled={pending}>
                <p className="cms-editor-hint">
                  Add another category if needed, or save your draft.
                </p>
                <div className="cms-editor-add-row">
                  <label className="cms-editor-field">
                    <span>New category ID</span>
                    <input
                      ref={newIdInput}
                      value={newId}
                      onChange={(event) => {
                        setNewId(event.target.value);
                        setIdError('');
                      }}
                      autoComplete="off"
                      maxLength={80}
                      aria-invalid={Boolean(idError)}
                      aria-describedby={
                        idError ? 'cms-new-category-error' : 'cms-new-category-help'
                      }
                    />
                    {idError ? (
                      <p className="cms-editor-field-error" id="cms-new-category-error">
                        {idError}
                      </p>
                    ) : (
                      <span className="cms-editor-hint" id="cms-new-category-help">
                        Use a short, lowercase ID such as “web”.
                      </span>
                    )}
                  </label>
                  <Button kind="action" type="button" variant="outline" onClick={addCategory}>
                    Add category
                  </Button>
                </div>
                {formState.isDirty && (
                  <p className="cms-editor-draft-state">
                    Category changes are in your browser draft.
                  </p>
                )}
              </fieldset>
            ),
          },
        ]}
      />
      {confirmationDialog}
    </section>
  );
}
