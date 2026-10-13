'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { MediaUpload } from './media-upload';
import styles from './media-library.module.css';

type MediaAsset = {
  id: string;
  version: string;
  state: 'staging' | 'verified' | 'published' | 'rejected';
  mime: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  alt: string;
  url: string | null;
  previewUrl: string | null;
  createdAt: string;
};

function isMediaAsset(value: unknown): value is MediaAsset {
  if (typeof value !== 'object' || value === null) return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.id === 'string' &&
    typeof asset.version === 'string' &&
    (asset.state === 'staging' ||
      asset.state === 'verified' ||
      asset.state === 'published' ||
      asset.state === 'rejected') &&
    (typeof asset.mime === 'string' || asset.mime === null) &&
    (typeof asset.width === 'number' || asset.width === null) &&
    (typeof asset.height === 'number' || asset.height === null) &&
    (typeof asset.byteSize === 'number' || asset.byteSize === null) &&
    typeof asset.alt === 'string' &&
    (typeof asset.url === 'string' || asset.url === null) &&
    (typeof asset.previewUrl === 'string' || asset.previewUrl === null) &&
    typeof asset.createdAt === 'string'
  );
}

function getAssets(value: unknown): MediaAsset[] {
  if (Array.isArray(value)) return value.filter(isMediaAsset);
  if (typeof value === 'object' && value !== null) {
    const data = value as { assets?: unknown; media?: unknown };
    const assets = Array.isArray(data.media) ? data.media : data.assets;
    if (Array.isArray(assets)) return assets.filter(isMediaAsset);
  }
  return [];
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

export function MediaLibrary() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/admin/media', {
          method: 'GET',
          cache: 'no-store',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) {
          setError(
            response.status === 401 || response.status === 403
              ? 'Your editing session ended. Sign in again to view the media library.'
              : 'The media library is temporarily unavailable. Try again shortly.',
          );
          return;
        }
        const body: unknown = await response.json();
        setAssets(getAssets(body));
      } catch {
        if (!controller.signal.aborted)
          setError('The media library is temporarily unavailable. Try again shortly.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey]);

  const refresh = useCallback(() => {
    setNotice('Verified image added to the media library.');
    setRefreshKey((key) => key + 1);
  }, []);

  return (
    <div className={styles.library}>
      <section className={styles['upload-panel']} aria-labelledby="upload-heading">
        <div>
          <p className={styles.eyebrow}>Add artwork</p>
          <h2 id="upload-heading">Upload a portfolio image.</h2>
          <p>
            PNG, JPEG, or WebP up to 5 MB. Uploads are verified first and stay private until
            published content uses them.
          </p>
        </div>
        <MediaUpload label="Choose an image" onChange={refresh} />
      </section>

      {notice ? (
        <p className={styles['live-message']} role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}

      <div className={styles['library-heading']}>
        <div>
          <p className={styles.eyebrow}>Asset collection</p>
          <h2>Media library</h2>
        </div>
        <button
          className={styles['refresh-button']}
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh list'}
        </button>
      </div>

      {error ? (
        <div className={styles['empty-state']} role="alert">
          <h3>Couldn’t load media.</h3>
          <p>{error}</p>
          {error.includes('Sign in') ? (
            <a href="/admin/login">Sign in again</a>
          ) : (
            <button type="button" onClick={() => setRefreshKey((key) => key + 1)}>
              Try again
            </button>
          )}
        </div>
      ) : loading ? (
        <p className={styles.loading} role="status">
          Loading the private media library…
        </p>
      ) : assets.length === 0 ? (
        <div className={styles['empty-state']}>
          <h3>No media assets yet.</h3>
          <p>
            Verified artwork can be attached to a draft. It becomes public only when a project or
            design using it is published.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {assets.map((asset) => {
            const imageSource =
              asset.state === 'verified' || asset.state === 'published' ? asset.previewUrl : null;
            return (
              <article className={styles.card} key={`${asset.id}:${asset.version}`}>
                <div className={styles['image-frame']}>
                  {imageSource && asset.width && asset.height ? (
                    <Image
                      src={imageSource}
                      unoptimized
                      alt={asset.alt}
                      width={asset.width}
                      height={asset.height}
                      sizes="(max-width: 48rem) 100vw, (max-width: 75rem) 50vw, 22rem"
                    />
                  ) : (
                    <span className={styles['image-unavailable']}>
                      {asset.state === 'verified'
                        ? 'Private preview unavailable'
                        : asset.state === 'published'
                          ? 'Preview unavailable'
                          : asset.state === 'staging'
                            ? 'Upload awaiting verification'
                            : 'Upload rejected'}
                    </span>
                  )}
                </div>
                <div className={styles['card-body']}>
                  <div className={styles['card-heading']}>
                    <h3>{asset.alt || 'Untitled image'}</h3>
                    <span
                      className={asset.state === 'published' ? styles.published : styles.pending}
                    >
                      {asset.state}
                    </span>
                  </div>
                  <p>
                    {asset.width && asset.height
                      ? `${asset.width} × ${asset.height}`
                      : 'Dimensions unavailable'}
                    {asset.mime ? ` · ${asset.mime}` : ''} · {formatBytes(asset.byteSize)}
                  </p>
                  <div className={styles['card-footer']}>
                    <time dateTime={asset.createdAt}>{formatDate(asset.createdAt)}</time>
                    {asset.url ? <code>{asset.id.slice(0, 8)}…</code> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
