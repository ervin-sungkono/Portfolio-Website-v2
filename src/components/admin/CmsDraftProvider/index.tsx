'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { mediaPathForDigest, type CmsImageMime, type CmsMediaScope } from '@/lib/cms/media-path';
import { emptyDraft, type CmsDraft } from './type';
import './style.css';

const cacheName = 'portfolio-cms-draft-v1';
const draftPath = '/__portfolio-cms-draft__/state';
const mediaPath = (path: string) => `/__portfolio-cms-draft__/media/${encodeURIComponent(path)}`;
const lockName = 'portfolio-cms-draft-v1:editing';

type AccessState = 'acquiring' | 'owner' | 'locked' | 'unsupported' | 'unavailable';

type DraftContextValue = {
  draft: CmsDraft;
  ready: boolean;
  saving: boolean;
  error: string;
  get: () => CmsDraft;
  update: (change: (current: CmsDraft) => CmsDraft) => Promise<boolean>;
  stageMedia: (
    file: File,
    scope: CmsMediaScope,
    slug: string,
  ) => Promise<{ path: string; alreadyExists?: boolean }>;
  readMedia: (path: string) => Promise<string | null>;
  removeMedia: (paths: string[]) => Promise<boolean>;
  clear: () => Promise<boolean>;
};

const DraftContext = createContext<DraftContextValue | null>(null);
let sameDocumentLockRequest: Promise<void> = Promise.resolve();

function DraftAccessGate({ state }: { state: AccessState }) {
  const messages: Record<AccessState, { heading: string; body: string; action: string }> = {
    acquiring: {
      heading: 'Checking browser draft access',
      body: 'The CMS is checking that this tab can safely edit the browser draft.',
      action: '',
    },
    owner: {
      heading: 'Loading the browser draft',
      body: 'The CMS is preparing the saved draft for this tab.',
      action: '',
    },
    locked: {
      heading: 'The CMS draft is open in another tab',
      body: 'Close the other /admin or /admin/import tab, then reload this page. This tab has not read or changed the saved draft.',
      action: 'Reload after closing the other tab',
    },
    unsupported: {
      heading: 'CMS editing is read-only in this browser',
      body: 'This browser does not provide the Web Locks API needed to protect the local draft. Use a current browser that supports Web Locks, then reload.',
      action: 'Try again',
    },
    unavailable: {
      heading: 'CMS editing is read-only right now',
      body: 'The browser could not claim the draft editing lock. Check browser site permissions, then reload. The saved draft was not read or changed in this tab.',
      action: 'Try again',
    },
  };
  const message = messages[state];
  const loading = state === 'acquiring' || state === 'owner';

  return (
    <div className="cms-draft-gate" aria-busy={loading}>
      <section className="cms-draft-gate-card" aria-labelledby="cms-draft-gate-heading">
        <p className="eyebrow">Portfolio CMS</p>
        <h1 id="cms-draft-gate-heading">{message.heading}</h1>
        <p role={loading ? 'status' : 'alert'}>{message.body}</p>
        {message.action && (
          <button className="button" type="button" onClick={() => window.location.reload()}>
            {message.action}
          </button>
        )}
      </section>
    </div>
  );
}

export function CmsDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<CmsDraft>(emptyDraft);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [access, setAccess] = useState<AccessState>('acquiring');
  const current = useRef(draft);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pendingSaves = useRef(0);
  const unreadable = useRef(false);
  const unsavedWrite = useRef(false);
  const owner = useRef(false);
  const acceptingWrites = useRef(false);
  const mounted = useRef(false);
  const releaseLock = useRef<(() => void) | null>(null);
  const get = useCallback(() => current.current, []);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingSaves.current === 0 && !unsavedWrite.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, []);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    acceptingWrites.current = false;

    async function loadDraft() {
      try {
        const cache = await caches.open(cacheName);
        const response = await cache.match(draftPath);
        if (response) {
          const value = (await response.json()) as CmsDraft;
          if (
            typeof value.repository !== 'string' ||
            !value.projects ||
            !Array.isArray(value.projects.upsert) ||
            !Array.isArray(value.projects.delete) ||
            !Array.isArray(value.media)
          ) {
            throw new Error('The saved browser draft could not be read.');
          }
          if (active) {
            current.current = value;
            setDraft(value);
          }
        }
      } catch {
        if (active) {
          unreadable.current = true;
          setError(
            'The browser could not load its saved draft. Check site storage before editing.',
          );
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    }

    void (async () => {
      await sameDocumentLockRequest.catch(() => undefined);
      if (!active) {
        return;
      }

      let lockManager: LockManager | undefined;
      try {
        lockManager = navigator.locks;
      } catch {
        setAccess('unavailable');
        setReady(true);
        return;
      }
      if (!lockManager) {
        setAccess('unsupported');
        setReady(true);
        return;
      }

      let release!: () => void;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      releaseLock.current = release;

      let request: Promise<void>;
      try {
        request = lockManager
          .request(lockName, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
            if (!lock) {
              if (active) {
                setAccess('locked');
                setReady(true);
              }
              return;
            }
            if (!active) {
              return;
            }

            owner.current = true;
            acceptingWrites.current = true;
            if (active) {
              setAccess('owner');
            }
            await loadDraft();
            return hold;
          })
          .then(() => undefined)
          .catch(() => {
            owner.current = false;
            acceptingWrites.current = false;
            if (active) {
              setAccess('unavailable');
              setReady(true);
            }
          });
      } catch {
        owner.current = false;
        acceptingWrites.current = false;
        setAccess('unavailable');
        setReady(true);
        return;
      }

      sameDocumentLockRequest = request;
      void request.finally(() => {
        if (sameDocumentLockRequest === request) {
          sameDocumentLockRequest = Promise.resolve();
        }
      });
    })();

    return () => {
      active = false;
      mounted.current = false;
      acceptingWrites.current = false;
      void queue.current
        .catch(() => undefined)
        .finally(() => {
          owner.current = false;
          releaseLock.current?.();
          releaseLock.current = null;
        });
    };
  }, []);

  const save = useCallback((task: () => Promise<void>, resolvesUnsaved = false) => {
    if (!owner.current || !acceptingWrites.current) {
      return Promise.resolve(false);
    }

    pendingSaves.current += 1;
    if (mounted.current) {
      setSaving(true);
    }

    const result = queue.current
      .then(async () => {
        if (!owner.current) {
          throw new Error('The browser draft editing lock is no longer available.');
        }
        await task();
      })
      .then(
        () => {
          if (resolvesUnsaved) {
            unsavedWrite.current = false;
          }
          if (mounted.current && (resolvesUnsaved || !unsavedWrite.current)) {
            setError('');
          }
          return true;
        },
        () => {
          unsavedWrite.current = true;
          if (mounted.current) {
            setError('The browser could not save this draft. Free site storage and try again.');
          }
          return false;
        },
      );
    queue.current = result.then(() => undefined);

    return result.finally(() => {
      pendingSaves.current = Math.max(0, pendingSaves.current - 1);
      if (mounted.current && pendingSaves.current === 0) {
        setSaving(false);
      }
    });
  }, []);

  const persistCurrentDraft = useCallback(async () => {
    while (true) {
      const pending = queue.current;
      await pending;
      if (!owner.current || !acceptingWrites.current) {
        return false;
      }
      if (queue.current !== pending) {
        continue;
      }
      if (!unsavedWrite.current) {
        return true;
      }
      const snapshot = current.current;
      return save(async () => {
        const cache = await caches.open(cacheName);
        await cache.put(draftPath, new Response(JSON.stringify(snapshot)));
      }, true);
    }
  }, [save]);

  const update = useCallback(
    async (change: (value: CmsDraft) => CmsDraft) => {
      if (!owner.current || !acceptingWrites.current || unreadable.current) {
        return false;
      }
      const next = change(current.current);
      if (next === current.current) {
        if (pendingSaves.current === 0 && !unsavedWrite.current) {
          return true;
        }
        return persistCurrentDraft();
      }
      current.current = next;
      setDraft(next);
      return save(async () => {
        const cache = await caches.open(cacheName);
        await cache.put(draftPath, new Response(JSON.stringify(next)));
      }, true);
    },
    [persistCurrentDraft, save],
  );

  const storeMedia = useCallback(
    (path: string, content: string) => {
      if (!owner.current || !acceptingWrites.current) {
        return Promise.resolve(false);
      }
      return save(async () => {
        const cache = await caches.open(cacheName);
        await cache.put(mediaPath(path), new Response(content));
      });
    },
    [save],
  );

  const readMedia = useCallback(async (path: string) => {
    if (!owner.current || !acceptingWrites.current) {
      return null;
    }
    await queue.current.catch(() => undefined);
    if (!owner.current || !acceptingWrites.current) {
      return null;
    }
    const cache = await caches.open(cacheName);
    return (await cache.match(mediaPath(path)))?.text() ?? null;
  }, []);

  const stageMedia = useCallback(
    async (file: File, scope: CmsMediaScope, slug: string) => {
      if (!owner.current || !acceptingWrites.current) {
        throw new Error('The CMS browser draft is read-only in this tab.');
      }
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 1_048_576 ||
        file.size === 0
      ) {
        throw new Error('Choose a PNG, JPEG, or WebP image up to 1 MiB.');
      }
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      const mime = file.type as CmsImageMime;
      const path = mediaPathForDigest(scope, slug, file.name, mime, hex);
      if (!path) {
        throw new Error('Choose an image with a valid filename and project destination.');
      }
      if (current.current.media.some((item) => item.path === path)) {
        return { path, alreadyExists: true };
      }
      const content = await new Promise<string>((done, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const data = typeof reader.result === 'string' ? reader.result : '';
          const separator = data.indexOf(',');
          if (separator < 0) {
            reject(new Error('The image could not be read.'));
          } else {
            done(data.slice(separator + 1));
          }
        };
        reader.onerror = () => reject(new Error('The image could not be read.'));
        reader.readAsDataURL(file);
      });
      if (!(await storeMedia(path, content))) {
        throw new Error('The image could not be saved in browser storage.');
      }
      if (
        !(await update((value) => ({
          ...value,
          media: [...value.media, { scope, slug, filename: file.name, mime, path }],
        })))
      ) {
        throw new Error('The image could not be added to the browser draft.');
      }
      return { path };
    },
    [storeMedia, update],
  );

  const removeMedia = useCallback(
    (paths: string[]) => {
      if (!owner.current || !acceptingWrites.current) {
        return Promise.resolve(false);
      }
      return save(async () => {
        const cache = await caches.open(cacheName);
        await Promise.all(paths.map((path) => cache.delete(mediaPath(path))));
      });
    },
    [save],
  );

  const clear = useCallback(async () => {
    if (!owner.current || !acceptingWrites.current) {
      return false;
    }
    const success = await save(async () => {
      await caches.delete(cacheName);
    }, true);
    if (success) {
      unreadable.current = false;
      current.current = emptyDraft();
      setDraft(current.current);
    }
    return success;
  }, [save]);

  if (access !== 'owner') {
    return <DraftAccessGate state={access} />;
  }

  if (!ready) {
    return <DraftAccessGate state="owner" />;
  }

  return (
    <DraftContext.Provider
      value={{
        draft,
        ready,
        saving,
        error,
        get,
        update,
        stageMedia,
        readMedia,
        removeMedia,
        clear,
      }}
    >
      {children}
    </DraftContext.Provider>
  );
}

export function useCmsDraft() {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error('The CMS draft provider is missing.');
  }
  return context;
}
