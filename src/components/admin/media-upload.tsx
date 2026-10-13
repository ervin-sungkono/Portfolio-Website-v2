'use client';

import { upload } from '@vercel/blob/client';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './media-upload.module.css';

export type MediaUploadValue = {
  assetId: string;
  version: string;
  state: 'verified' | 'published';
  url: string;
  previewUrl: string;
  alt: string;
  width: number;
  height: number;
};

type MediaUploadProps = {
  value?: Partial<MediaUploadValue> | null;
  onChange: (value: MediaUploadValue) => void;
  label?: string;
  disabled?: boolean;
};

type JsonResult = { media?: Record<string, unknown>; error?: string };

class MediaUploadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaUploadRequestError';
  }
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readResponse(response: Response): Promise<JsonResult> {
  try {
    const value: unknown = await response.json();
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonResult;
  } catch {
    // Show the generic request failure below.
  }
  return {};
}

function mediaValue(input: Record<string, unknown>, altFallback: string): MediaUploadValue | null {
  const id = input.id;
  const version = input.version;
  const url = input.url;
  const state = input.state;
  const alt = input.alt;
  const width = input.width;
  const height = input.height;
  if (
    typeof id !== 'string' ||
    !UUID_PATTERN.test(id) ||
    typeof version !== 'string' ||
    !/^[a-f0-9]{64}$/.test(version) ||
    (state !== 'verified' && state !== 'published') ||
    typeof url !== 'string' ||
    url !== `/media/published/${id}/${version}` ||
    !Number.isInteger(width) ||
    !Number.isInteger(height)
  ) {
    return null;
  }
  return {
    assetId: id,
    version,
    state,
    url,
    previewUrl: `/api/admin/media/${id}`,
    alt: typeof alt === 'string' ? alt : altFallback,
    width: width as number,
    height: height as number,
  };
}

export function MediaUpload({
  value,
  onChange,
  label = 'Image',
  disabled = false,
}: MediaUploadProps) {
  const [alt, setAlt] = useState(value?.alt ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [localPreview, setLocalPreview] = useState('');
  const busyRef = useRef(false);

  useEffect(() => {
    if (!file) {
      setLocalPreview('');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    if (typeof value?.alt === 'string') setAlt(value.alt);
  }, [value?.assetId, value?.alt]);

  const previewSource = useMemo(() => {
    if (localPreview) return localPreview;
    if (value?.assetId && UUID_PATTERN.test(value.assetId))
      return `/api/admin/media/${value.assetId}`;
    return typeof value?.url === 'string' ? value.url : '';
  }, [localPreview, value?.assetId, value?.url]);

  async function submit() {
    if (busyRef.current || busy || disabled) return;
    setError('');
    if (!file) {
      setError('Choose an image file.');
      return;
    }
    const cleanAlt = alt.trim();
    if (!cleanAlt || cleanAlt.length > 500) {
      setError('Enter image alternative text up to 500 characters.');
      return;
    }
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      setError('Images must be non-empty and 5 MiB or smaller.');
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setProgress(0);
    try {
      const intentResponse = await fetch('/api/admin/media', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: cleanAlt }),
      });
      const intentBody = await readResponse(intentResponse);
      const id = intentBody.media?.id;
      if (!intentResponse.ok || typeof id !== 'string' || !UUID_PATTERN.test(id)) {
        throw new MediaUploadRequestError(intentBody.error ?? 'The upload could not be started.');
      }

      // The SDK keeps its short-lived, path-constrained upload token internal.
      await upload(`staging/${id.toLowerCase()}/original`, file, {
        access: 'private',
        handleUploadUrl: '/api/admin/media/upload',
        clientPayload: JSON.stringify({ id: id.toLowerCase() }),
        contentType: file.type,
        multipart: false,
        onUploadProgress: ({ percentage }) => setProgress(Math.min(100, Math.max(0, percentage))),
      });

      const finalizeResponse = await fetch(`/api/admin/media/${encodeURIComponent(id)}/finalize`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const finalizeBody = await readResponse(finalizeResponse);
      const saved = finalizeBody.media && mediaValue(finalizeBody.media, cleanAlt);
      if (!finalizeResponse.ok || !saved) {
        throw new MediaUploadRequestError(
          finalizeBody.error ?? 'The image could not be verified and saved privately.',
        );
      }

      setAlt(saved.alt);
      setFile(null);
      setProgress(null);
      onChange(saved);
    } catch (cause) {
      setError(
        cause instanceof MediaUploadRequestError
          ? cause.message
          : 'The image upload failed. Try again.',
      );
      setProgress(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <fieldset className={styles.root} disabled={disabled || busy}>
      <legend>{label}</legend>
      {previewSource ? (
        <img
          className={styles.preview}
          src={previewSource}
          alt={alt || 'Selected image preview'}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <label className={styles.field}>
        Image description
        <input
          autoComplete="off"
          maxLength={500}
          onChange={(event) => setAlt(event.currentTarget.value)}
          required
          value={alt}
        />
      </label>
      <label className={styles.field}>
        Choose a PNG, JPEG, or WebP image
        <input
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            setError('');
            setFile(event.currentTarget.files?.[0] ?? null);
          }}
          type="file"
        />
      </label>
      <button className={styles.submit} onClick={submit} type="button" disabled={disabled || busy}>
        {busy ? 'Uploading image…' : 'Upload image'}
      </button>
      {progress !== null ? (
        <progress aria-label="Image upload progress" max={100} value={progress} />
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.hint} aria-live="polite">
        {busy
          ? 'The image is being uploaded and checked. It stays private until you publish content that uses it.'
          : value?.url
            ? 'This verified image stays private until you publish content that uses it.'
            : 'The image stays private until you publish content that uses it.'}
      </p>
    </fieldset>
  );
}
