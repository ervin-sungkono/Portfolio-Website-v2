import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { FieldPath } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Select';
import type { Technologies } from '@/lib/cms/schemas';
import { useConfirmDialog } from '../../ConfirmDialog';
import { CmsWizardDialog } from '../../CmsWizardDialog';
import type { TechnologiesPanelProps } from './type';
import './style.css';

const technologyIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function TechnologiesPanel({
  form,
  active,
  pending,
  feedback,
  onSave,
  onClearMessage,
}: TechnologiesPanelProps) {
  const { control, register, getValues, getFieldState, reset, formState } = form;
  const { confirm, confirmationDialog } = useConfirmDialog();
  const technologies = useWatch({ control }) || {};
  const technologyEntries = Object.entries(technologies) as Array<[string, Technologies[string]]>;
  const [newId, setNewId] = useState('');
  const [idError, setIdError] = useState('');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [focusFieldName, setFocusFieldName] = useState<string>();
  const newIdInput = useRef<HTMLInputElement>(null);
  const currentId = Object.hasOwn(technologies, selectedId)
    ? selectedId
    : technologyEntries[0]?.[0];

  function addTechnology() {
    const id = newId.trim().toLowerCase();
    if (!technologyIdPattern.test(id)) {
      setIdError('Use lowercase letters, numbers, and single hyphens for the ID.');
      newIdInput.current?.focus();
      return;
    }
    if (Object.hasOwn(getValues(), id)) {
      setIdError('That technology ID already exists.');
      newIdInput.current?.focus();
      return;
    }
    reset({ ...getValues(), [id]: { label: '' } }, { keepDefaultValues: true });
    setNewId('');
    setIdError('');
    setSelectedId(id);
    setFocusFieldName(`${id}.label`);
    setStep(0);
    onClearMessage();
  }

  function removeTechnology(id: string) {
    const next = { ...getValues() };
    delete next[id];
    reset(next, { keepDefaultValues: true });
    onClearMessage();
  }

  function editTechnology(id: string) {
    setSelectedId(id);
    setStep(0);
    setFocusFieldName(undefined);
    setOpen(true);
  }

  async function confirmRemoveTechnology(id: string) {
    const technology = getValues()[id];
    if (!technology) {
      return;
    }
    if (
      await confirm({
        title: `Remove ${technology.label || id}?`,
        description:
          'This removes the technology from your browser draft. Projects that still reference it must be updated before submission.',
        confirmLabel: 'Remove technology',
        danger: true,
      })
    ) {
      removeTechnology(id);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    if (newId.trim()) {
      event.preventDefault();
      setIdError('Add this technology or clear the ID before saving.');
      newIdInput.current?.focus();
      return;
    }
    void form.handleSubmit(onSave, (errors) => {
      const id = Object.keys(errors)[0];
      if (id) {
        const field = errors[id]?.label ? 'label' : 'icon';
        setSelectedId(id);
        setFocusFieldName(`${id}.${field}`);
        setStep(0);
      }
    })(event);
  }

  async function validateTechnologies() {
    const valid = await form.trigger();
    if (!valid) {
      const invalid = technologyEntries.find(([id]) =>
        ['label', 'icon'].some(
          (field) => getFieldState(`${id}.${field}` as FieldPath<Technologies>).error,
        ),
      );
      if (invalid) {
        const [id] = invalid;
        const field = getFieldState(`${id}.label` as FieldPath<Technologies>).error
          ? 'label'
          : 'icon';
        if (id === currentId) {
          form.setFocus(`${id}.${field}` as FieldPath<Technologies>);
        }
        setSelectedId(id);
        setFocusFieldName(`${id}.${field}`);
      }
    }
    return valid;
  }

  return (
    <section
      id="cms-editor-technologies-panel"
      className="cms-editor-panel cms-editor-technologies-panel"
      aria-labelledby="cms-technologies-heading"
      hidden={!active}
    >
      <div className="cms-editor-panel-heading">
        <div>
          <p className="eyebrow">Project taxonomy</p>
          <h2 id="cms-technologies-heading">Technologies</h2>
        </div>
      </div>
      {!open && feedback}
      <div className="cms-editor-overview-table-wrap">
        <table className="cms-editor-overview-table" aria-label="Current technologies">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Label</th>
              <th scope="col">Icon</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {technologyEntries
              .slice()
              .sort(([, a], [, b]) => a.label.localeCompare(b.label))
              .map(([id, technology]) => (
                <tr key={id}>
                  <th scope="row">{id}</th>
                  <td>{technology.label || '—'}</td>
                  <td>{technology.icon || '—'}</td>
                  <td>
                    <div className="cms-editor-overview-actions">
                      <Button
                        kind="action"
                        type="button"
                        variant="outline"
                        onClick={() => editTechnology(id)}
                        disabled={pending}
                      >
                        Edit
                      </Button>
                      <Button
                        kind="action"
                        type="button"
                        variant="outline"
                        className="cms-editor-danger-button"
                        onClick={() => void confirmRemoveTechnology(id)}
                        disabled={pending}
                        aria-label={`Remove technology ${technology.label || id}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            {technologyEntries.length === 0 && (
              <tr>
                <td colSpan={4}>No technologies are configured.</td>
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
        Edit technologies
      </Button>
      <CmsWizardDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit technologies"
        description="Changes stay in your browser draft until you submit all changes."
        activeStep={step}
        onStepChange={(nextStep) => {
          setFocusFieldName(undefined);
          setStep(nextStep);
        }}
        onNext={validateTechnologies}
        onSubmit={submit}
        onChange={onClearMessage}
        pending={pending}
        submitLabel="Save technologies draft"
        focusFieldName={focusFieldName}
        feedback={open ? feedback : null}
        steps={[
          {
            label: 'Edit technologies',
            content: (
              <fieldset className="cms-editor-form-group" disabled={pending}>
                <p className="cms-editor-hint">
                  Technology IDs are stable project references. Icon paths must point to uploaded
                  files under <code>media/technologies/</code>.
                </p>
                {technologyEntries.length > 0 ? (
                  <label className="cms-editor-field">
                    <span>Choose a technology</span>
                    <Select
                      aria-label="Choose a technology"
                      value={currentId ?? ''}
                      onValueChange={(value) => {
                        setSelectedId(value);
                        setFocusFieldName(undefined);
                      }}
                      options={technologyEntries
                        .slice()
                        .sort(([, a], [, b]) => a.label.localeCompare(b.label))
                        .map(([id, technology]) => ({
                          value: id,
                          label: technology.label || id,
                        }))}
                    />
                  </label>
                ) : (
                  <p className="cms-editor-hint">No technologies yet. Continue to add one.</p>
                )}
                <div className="cms-editor-stack">
                  {technologyEntries
                    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
                    .map(([id, technology]) => {
                      const labelPath = `${id}.label` as FieldPath<Technologies>;
                      const iconPath = `${id}.icon` as FieldPath<Technologies>;
                      const labelError = getFieldState(labelPath).error?.message;
                      const iconError = getFieldState(iconPath).error?.message;
                      return (
                        <div
                          className="cms-editor-repeat-row cms-editor-technology-row"
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
                                labelError ? `cms-technology-${id}-label-error` : undefined
                              }
                            />
                            {labelError && (
                              <p
                                className="cms-editor-field-error"
                                id={`cms-technology-${id}-label-error`}
                              >
                                {labelError}
                              </p>
                            )}
                          </label>
                          <label className="cms-editor-field">
                            <span>
                              Icon path <span className="cms-editor-hint-inline">(optional)</span>
                            </span>
                            <input
                              {...register(iconPath, {
                                setValueAs: (value) => (value === '' ? undefined : value),
                              })}
                              placeholder="Upload an icon in Images"
                              aria-invalid={Boolean(iconError)}
                              aria-describedby={
                                iconError ? `cms-technology-${id}-icon-error` : undefined
                              }
                            />
                            {iconError && (
                              <p
                                className="cms-editor-field-error"
                                id={`cms-technology-${id}-icon-error`}
                              >
                                {iconError}
                              </p>
                            )}
                          </label>
                          <button
                            type="button"
                            className="cms-editor-remove-button"
                            onClick={() => void confirmRemoveTechnology(id)}
                            aria-label={`Remove technology ${technology.label || id}`}
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
            label: 'Add technology',
            content: (
              <fieldset className="cms-editor-form-group" disabled={pending}>
                <p className="cms-editor-hint">
                  Add another technology if needed, or save your draft.
                </p>
                <div className="cms-editor-add-row">
                  <label className="cms-editor-field">
                    <span>New technology ID</span>
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
                        idError ? 'cms-new-technology-error' : 'cms-new-technology-help'
                      }
                    />
                    {idError ? (
                      <p className="cms-editor-field-error" id="cms-new-technology-error">
                        {idError}
                      </p>
                    ) : (
                      <span className="cms-editor-hint" id="cms-new-technology-help">
                        Use a short, lowercase ID such as “react”.
                      </span>
                    )}
                  </label>
                  <Button kind="action" type="button" variant="outline" onClick={addTechnology}>
                    Add technology
                  </Button>
                </div>
                {formState.isDirty && (
                  <p className="cms-editor-draft-state">
                    Technology changes are in your browser draft.
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
