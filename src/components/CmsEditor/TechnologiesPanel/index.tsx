import type { TechnologiesPanelProps } from './type';
import './style.css';
import { useState } from 'react';
import type { FieldPath } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import type { Technologies } from '@/lib/cms/schemas';
import { CmsMessage } from '../CmsMessage';

const technologyIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function TechnologiesPanel({
  form,
  active,
  pending,
  message,
  onSave,
  onClearMessage,
  onReload,
  onRetry,
}: TechnologiesPanelProps) {
  const { control, register, getValues, getFieldState, reset, formState } = form;
  const technologies = useWatch({ control }) || {};
  const technologyEntries = Object.entries(technologies) as Array<[string, Technologies[string]]>;
  const [newId, setNewId] = useState('');
  const [idError, setIdError] = useState('');

  function addTechnology() {
    const id = newId.trim().toLowerCase();
    if (!technologyIdPattern.test(id)) {
      setIdError('Use lowercase letters, numbers, and single hyphens for the ID.');
      return;
    }
    if (Object.hasOwn(getValues(), id)) {
      setIdError('That technology ID already exists.');
      return;
    }
    reset({ ...getValues(), [id]: { label: '' } }, { keepDefaultValues: true });
    setNewId('');
    setIdError('');
    onClearMessage();
  }

  function removeTechnology(id: string) {
    const next = { ...getValues() };
    delete next[id];
    reset(next, { keepDefaultValues: true });
    onClearMessage();
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
      <CmsMessage message={message} onReload={onReload} onRetry={onRetry} pending={pending} />
      <form
        className="cms-editor-form"
        onSubmit={form.handleSubmit(onSave)}
        onChange={onClearMessage}
        noValidate
      >
        <fieldset disabled={pending}>
          <p className="cms-editor-hint">
            Technology IDs are stable project references. Icon paths must point to uploaded files
            under <code>media/technologies/</code>.
          </p>
          <div className="cms-editor-stack">
            {technologyEntries
              .sort(([, a], [, b]) => a.label.localeCompare(b.label))
              .map(([id, technology]) => {
                const labelPath = `${id}.label` as FieldPath<Technologies>;
                const iconPath = `${id}.icon` as FieldPath<Technologies>;
                const labelError = getFieldState(labelPath).error?.message;
                const iconError = getFieldState(iconPath).error?.message;
                return (
                  <div className="cms-editor-repeat-row cms-editor-technology-row" key={id}>
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
                        aria-describedby={iconError ? `cms-technology-${id}-icon-error` : undefined}
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
                      onClick={() => removeTechnology(id)}
                      aria-label={`Remove technology ${technology.label || id}`}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
          </div>
          <div className="cms-editor-add-row">
            <label className="cms-editor-field">
              <span>New technology ID</span>
              <input
                value={newId}
                onChange={(event) => {
                  setNewId(event.target.value);
                  setIdError('');
                }}
                autoComplete="off"
                maxLength={80}
                aria-invalid={Boolean(idError)}
                aria-describedby={idError ? 'cms-new-technology-error' : 'cms-new-technology-help'}
              />
              {idError && (
                <p className="cms-editor-field-error" id="cms-new-technology-error">
                  {idError}
                </p>
              )}
              {!idError && (
                <span className="cms-editor-hint" id="cms-new-technology-help">
                  Use a short, lowercase ID such as “react”.
                </span>
              )}
            </label>
            <button type="button" className="button button-outline" onClick={addTechnology}>
              Add technology
            </button>
          </div>
        </fieldset>
        <div className="cms-editor-actions">
          <button className="button" type="submit" disabled={pending}>
            Save technologies
          </button>
          {formState.isDirty && (
            <span className="cms-editor-draft-state">Unsaved technology changes</span>
          )}
        </div>
      </form>
    </section>
  );
}
