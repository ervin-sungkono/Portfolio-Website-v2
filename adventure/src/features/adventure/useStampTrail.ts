'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeTrail, pauseTrail, startTrail, trailComplete, visitTrailStop } from './stampTrailModel.mjs';

const STORAGE_KEY = 'little-world-stamp-trail-v1';
type Progress = ReturnType<typeof normalizeTrail>;

export function useStampTrail() {
  const current = useRef<Progress>(normalizeTrail(null));
  const [progress, setProgress] = useState<Progress>(() => normalizeTrail(null));
  const [newCompletion, setNewCompletion] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { current.current = normalizeTrail(JSON.parse(saved)); setProgress(current.current); }
    } catch { /* The trail still works without storage. */ }
  }, []);

  const commit = useCallback((next: Progress) => {
    if (next === current.current) return;
    const justFinished = !trailComplete(current.current) && trailComplete(next);
    current.current = next;
    setProgress(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Progress lasts for this visit. */ }
    if (justFinished) setNewCompletion(true);
  }, []);
  const start = useCallback((firstId?: string) => commit(startTrail(current.current, firstId)), [commit]);
  const pause = useCallback(() => commit(pauseTrail(current.current)), [commit]);
  const visit = useCallback((id: string) => commit(visitTrailStop(current.current, id)), [commit]);
  const restart = useCallback((firstId?: string) => { setNewCompletion(false); commit(startTrail(normalizeTrail(null), firstId)); }, [commit]);
  const clearCompletion = useCallback(() => setNewCompletion(false), []);

  return { progress, start, pause, visit, restart, newCompletion, clearCompletion };
}
