'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { readJson } from '../response';
import type { DesignsPanelProps, DribbbleShot } from './type';
import './style.css';

type SelectionResponse = {
  shots: DribbbleShot[];
  designs: string[];
  sha: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSelection(value: Record<string, unknown>): SelectionResponse {
  const selection = value.selection;
  if (!Array.isArray(value.shots) || !isRecord(selection)) {
    throw new Error('The CMS returned an incomplete Dribbble shot list.');
  }
  if (
    typeof selection.sha !== 'string' ||
    !/^[a-f0-9]{40}$/i.test(selection.sha) ||
    !Array.isArray(selection.designs) ||
    selection.designs.some((id) => typeof id !== 'string' || !/^[1-9]\d*$/.test(id))
  ) {
    throw new Error('The CMS returned an invalid design selection.');
  }

  const shots = value.shots.map((shot) => {
    if (
      !isRecord(shot) ||
      typeof shot.id !== 'string' ||
      !/^[1-9]\d*$/.test(shot.id) ||
      typeof shot.title !== 'string' ||
      typeof shot.url !== 'string' ||
      typeof shot.image !== 'string'
    ) {
      throw new Error('The CMS returned an invalid Dribbble shot.');
    }
    const url = new URL(shot.url);
    const image = new URL(shot.image);
    if (
      url.protocol !== 'https:' ||
      !['dribbble.com', 'www.dribbble.com'].includes(url.hostname) ||
      image.protocol !== 'https:'
    ) {
      throw new Error('The CMS returned an unsafe Dribbble shot URL.');
    }
    return {
      id: shot.id,
      title: shot.title,
      url: url.href,
      image: image.href,
    };
  });

  return {
    shots,
    designs: selection.designs as string[],
    sha: selection.sha,
  };
}

export function DesignsPanel({
  active,
  pending,
  feedback,
  onSave,
  onClearMessage,
  onDirtyChange,
}: DesignsPanelProps) {
  const [shots, setShots] = useState<DribbbleShot[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expectedSha, setExpectedSha] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState(-1);
  const [isDirty, setIsDirty] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);

  const loadSelection = useCallback(
    async (signal: AbortSignal) => {
      setIsLoading(true);
      setLoadError('');
      try {
        const response = await fetch('/api/cms/dribbble/shots', {
          cache: 'no-store',
          signal,
        });
        const body = await readJson(response);
        if (!response.ok || typeof body.error === 'string') {
          throw new Error(
            typeof body.error === 'string'
              ? body.error
              : `The Dribbble shot list could not be loaded (${response.status}).`,
          );
        }
        const loaded = parseSelection(body);
        setShots(loaded.shots);
        setSelectedIds(loaded.designs);
        setExpectedSha(loaded.sha);
        setIsDirty(false);
        onDirtyChange(false);
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        setLoadError(
          error instanceof Error
            ? error.message
            : 'The Dribbble shot list could not be loaded. Try again.',
        );
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
          setHasLoaded(true);
          setLoadedVersion(loadVersion);
        }
      }
    },
    [loadVersion, onDirtyChange],
  );

  useEffect(() => {
    if (!active || (hasLoaded && loadedVersion === loadVersion)) {
      return;
    }
    const controller = new AbortController();
    void loadSelection(controller.signal);
    return () => controller.abort();
  }, [active, hasLoaded, loadSelection, loadVersion, loadedVersion]);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const shotIds = useMemo(() => new Set(shots.map((shot) => shot.id)), [shots]);
  const unavailableIds = selectedIds.filter((id) => !shotIds.has(id));

  function markDirty() {
    setIsDirty(true);
    onDirtyChange(true);
    onClearMessage();
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
    markDirty();
  }

  async function saveSelection() {
    if (!expectedSha || !isDirty || pending) {
      return;
    }
    const reply = await onSave({ expectedSha, designs: selectedIds });
    if (!reply) {
      return;
    }
    if (reply.sha) {
      setExpectedSha(reply.sha);
    }
    setIsDirty(false);
    onDirtyChange(false);
  }

  function reload() {
    if (
      isDirty &&
      !window.confirm('Reload the saved selection and discard these show/hide changes?')
    ) {
      return;
    }
    onClearMessage();
    setLoadVersion((version) => version + 1);
  }

  return (
    <section
      id="cms-editor-designs-panel"
      className="cms-editor-panel cms-editor-designs-panel"
      aria-labelledby="cms-designs-heading"
      hidden={!active}
    >
      <div className="cms-editor-panel-heading">
        <div>
          <p className="eyebrow">Dribbble shots</p>
          <h2 id="cms-designs-heading">Design Selection</h2>
          <p>Choose which shots appear on the public Design page and homepage preview.</p>
        </div>
        <button
          type="button"
          className="button button-outline"
          onClick={reload}
          disabled={pending || isLoading}
        >
          {isLoading ? 'Loading shots…' : 'Reload shots and selection'}
        </button>
      </div>

      {feedback}
      {loadError && (
        <div className="cms-editor-message cms-editor-message-error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="cms-editor-text-button" onClick={reload}>
            Try loading Dribbble again
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="cms-editor-refreshing" role="status">
          Loading your Dribbble shots…
        </p>
      ) : !loadError ? (
        <>
          <p className="cms-editor-designs-count" aria-live="polite">
            {selectedIds.length} selected from {shots.length} available shots
            {unavailableIds.length > 0 &&
              ` · ${unavailableIds.length} saved ${unavailableIds.length === 1 ? 'shot is' : 'shots are'} unavailable`}
          </p>

          {unavailableIds.length > 0 && (
            <ul
              className="cms-editor-designs-grid"
              aria-label="Previously selected unavailable shots"
            >
              {unavailableIds.map((id) => (
                <li className="cms-editor-design-card cms-editor-design-card-unavailable" key={id}>
                  <div className="cms-editor-design-unavailable-copy">
                    <strong>Saved shot {id}</strong>
                    <p>This shot is missing from the current Dribbble response.</p>
                  </div>
                  <label className="cms-editor-design-toggle">
                    <input
                      type="checkbox"
                      checked
                      aria-label={`Show on portfolio: saved shot ${id}`}
                      onChange={() => toggleSelection(id)}
                      disabled={pending}
                    />
                    <span>Show on portfolio</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {shots.length > 0 ? (
            <ul className="cms-editor-designs-grid" aria-label="Dribbble shots">
              {shots.map((shot) => (
                <li className="cms-editor-design-card" key={shot.id}>
                  <a
                    className="cms-editor-design-preview"
                    href={shot.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${shot.title} on Dribbble`}
                  >
                    <Image src={shot.image} alt="" width={400} height={300} unoptimized />
                  </a>
                  <div className="cms-editor-design-card-copy">
                    <a href={shot.url} target="_blank" rel="noreferrer">
                      {shot.title}
                    </a>
                    <label className="cms-editor-design-toggle">
                      <input
                        type="checkbox"
                        checked={selected.has(shot.id)}
                        aria-label={`Show on portfolio: ${shot.title}`}
                        onChange={() => toggleSelection(shot.id)}
                        disabled={pending}
                      />
                      <span>Show on portfolio</span>
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          ) : unavailableIds.length === 0 ? (
            <p className="cms-editor-empty">Dribbble did not return any usable shots.</p>
          ) : null}

          <div className="cms-editor-actions">
            <button
              type="button"
              className="button"
              onClick={() => void saveSelection()}
              disabled={pending || !expectedSha || !isDirty}
            >
              Save selection
            </button>
            {isDirty && (
              <span className="cms-editor-draft-state">Unsaved design selection changes</span>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
