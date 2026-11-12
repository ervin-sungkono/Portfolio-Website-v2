'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ACHIEVEMENTS, createVisitClock, mergeProgress, normalizeProgress, unlockedIds, updateProgress } from './achievementModel.mjs';

type Progress = ReturnType<typeof normalizeProgress>;
const STORAGE_KEY = 'little-world-achievements-v1';
const LEGACY_BEST_KEY = 'little-world-garden-glide-best';

function readSaved(): Progress {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const legacy = Number(localStorage.getItem(LEGACY_BEST_KEY));
    let parsed: unknown = null;
    if (saved) { try { parsed = JSON.parse(saved); } catch { /* Keep the old best score if this record is damaged. */ } }
    return normalizeProgress(parsed, legacy);
  } catch { return normalizeProgress(null); }
}

function saveProgress(progress: Progress): Progress {
  try {
    // Preserve higher values written by another tab, even if this tab is stale.
    const merged = mergeProgress(progress, readSaved());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch { return progress; }
}

export function useAchievements() {
  const current = useRef<Progress>(normalizeProgress(null));
  const [progress, setProgress] = useState<Progress>(() => normalizeProgress(null));
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const commit = useCallback((next: Progress, persist: boolean, announce = true, render = true) => {
    const before = unlockedIds(current.current);
    const merged = persist ? saveProgress(next) : next;
    current.current = merged;
    const earned = ACHIEVEMENTS.filter(item => !before.includes(item.id) && unlockedIds(merged).includes(item.id));
    if (render && (persist || earned.length)) setProgress(merged);
    if (announce && earned.length) {
      setNotice(earned.map(item => item.title).join(' & '));
      if (noticeTimer.current !== undefined) window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
      if (!persist) { current.current = saveProgress(merged); if (render) setProgress(current.current); }
    }
  }, []);

  const recordScore = useCallback((score: number) => {
    commit(updateProgress(current.current, { score }), true);
  }, [commit]);

  useEffect(() => {
    const loaded = saveProgress(readSaved());
    current.current = loaded;
    setProgress(loaded);
    let pageActive = true;
    const clock = createVisitClock(performance.now(), !document.hidden);
    let savedAt = performance.now();
    let interval: number | undefined;
    const tick = (visible: boolean, force = false, render = true) => {
      const now = performance.now();
      const next = updateProgress(current.current, { elapsedMs: clock.tick(now, visible) });
      const persist = force || now - savedAt >= 5000;
      commit(next, persist, render, render);
      if (persist) savedAt = now;
    };
    const stopTimer = () => { if (interval !== undefined) window.clearInterval(interval); interval = undefined; };
    const startTimer = () => {
      if (interval === undefined && pageActive && !document.hidden) interval = window.setInterval(() => tick(pageActive && !document.hidden), 1000);
    };
    const onVisibility = () => {
      tick(pageActive && !document.hidden, true);
      if (pageActive && !document.hidden) startTimer(); else stopTimer();
    };
    const onPageHide = () => { pageActive = false; tick(false, true, false); stopTimer(); };
    const onPageShow = () => { pageActive = true; tick(!document.hidden, false); startTimer(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const merged = mergeProgress(current.current, readSaved());
      current.current = merged;
      setProgress(merged);
    };
    startTimer();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('storage', onStorage);
    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('storage', onStorage);
      tick(false, true, false);
      if (noticeTimer.current !== undefined) window.clearTimeout(noticeTimer.current);
    };
  }, [commit]);

  return { progress, notice, recordScore };
}
