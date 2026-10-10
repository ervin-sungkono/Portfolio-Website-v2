'use client';

import { useEffect, useRef, useState } from 'react';
import type { Container, Engine, ISourceOptions } from '@tsparticles/engine';
import styles from './particle-accent.module.css';

let engineReady: Promise<Engine> | undefined;

function loadEngine() {
  engineReady ??= Promise.all([
    import('@tsparticles/engine'),
    import('@tsparticles/basic'),
    import('@tsparticles/plugin-interactivity'),
    import('@tsparticles/interaction-external-repulse'),
    import('@tsparticles/interaction-particles-links'),
  ]).then(
    async ([
      { tsParticles },
      { loadBasic },
      { loadInteractivityPlugin },
      { loadExternalRepulseInteraction },
      { loadParticlesLinksInteraction },
    ]) => {
      await loadBasic(tsParticles);
      await loadInteractivityPlugin(tsParticles);
      await loadExternalRepulseInteraction(tsParticles);
      await loadParticlesLinksInteraction(tsParticles);
      return tsParticles;
    },
  );
  return engineReady;
}

export function ParticleAccent({ variant = 'not-found' }: { variant?: 'not-found' | 'hero' }) {
  const element = useRef<HTMLDivElement>(null);
  const container = useRef<Container | undefined>(undefined);
  const pausedRef = useRef(false);
  const inViewport = useRef(true);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState({ enabled: false, interactive: false, dark: false });

  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = matchMedia('(min-width: 48rem) and (hover: hover) and (pointer: fine)');
    const sideSpace = matchMedia('(min-width: 90rem) and (min-height: 48rem)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    const sync = () => {
      const bounds = element.current?.getBoundingClientRect();
      const sideFits =
        !!bounds && bounds.width > 0 && bounds.left >= 0 && bounds.right <= innerWidth;
      setSettings({
        enabled:
          !motion.matches &&
          !connection?.saveData &&
          (variant === 'not-found' || (sideSpace.matches && pointer.matches && sideFits)),
        interactive: variant === 'not-found' && pointer.matches,
        dark: document.documentElement.dataset.theme === 'dark',
      });
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    motion.addEventListener('change', sync);
    pointer.addEventListener('change', sync);
    sideSpace.addEventListener('change', sync);
    const resize = variant === 'hero' ? new ResizeObserver(sync) : undefined;
    if (element.current) resize?.observe(element.current);
    sync();
    return () => {
      observer.disconnect();
      resize?.disconnect();
      motion.removeEventListener('change', sync);
      pointer.removeEventListener('change', sync);
      sideSpace.removeEventListener('change', sync);
    };
  }, [variant]);

  useEffect(() => {
    setReady(false);
    if (!settings.enabled || !element.current) return;
    let cancelled = false;
    let instance: Container | undefined;
    let visibility: IntersectionObserver | undefined;
    const syncPlayback = () => {
      if (pausedRef.current || !inViewport.current || document.hidden) instance?.pause();
      else instance?.play();
    };
    const host = element.current;
    const count = variant === 'hero' ? 12 : settings.interactive ? 56 : 24;
    const options: ISourceOptions = {
      fullScreen: { enable: false },
      fpsLimit: variant === 'hero' ? 20 : 30,
      detectRetina: false,
      pauseOnBlur: true,
      pauseOnOutsideViewport: true,
      autoPlay: !pausedRef.current,
      particles: {
        number: { value: count, density: { enable: false }, limit: { value: count } },
        paint: {
          color: { value: settings.dark ? ['#91b4ff', '#a9b0ba'] : ['#2459d3', '#737d8c'] },
        },
        opacity: { value: { min: 0.18, max: variant === 'hero' ? 0.3 : 0.45 } },
        size: { value: { min: 1, max: variant === 'hero' ? 2 : 3 } },
        shape: { type: 'circle' },
        links: {
          enable: variant === 'hero',
          distance: 75,
          color: settings.dark ? '#91b4ff' : '#2459d3',
          opacity: 0.18,
          width: 0.75,
        },
        move: {
          enable: true,
          speed: variant === 'hero' ? 0.25 : 0.6,
          outModes: { default: 'out' },
        },
      },
      interactivity: {
        detectsOn: 'window',
        events: {
          onHover: { enable: settings.interactive, mode: 'repulse' },
          onClick: { enable: false },
        },
        modes: { repulse: { distance: 90, speed: 0.35, factor: 10, maxSpeed: 2 } },
      },
    };
    void loadEngine()
      .then(async (engine) => {
        if (cancelled) return;
        instance = await engine.load({ element: host, options });
        if (cancelled) {
          instance?.destroy();
          return;
        }
        container.current = instance;
        document.addEventListener('visibilitychange', syncPlayback);
        if (pausedRef.current) {
          instance?.pause();
          instance?.draw(true);
        }
        // Keep automatic visibility pauses separate from the visitor's choice.
        visibility = new IntersectionObserver(([entry]) => {
          inViewport.current = entry.isIntersecting;
          syncPlayback();
        });
        visibility.observe(host);
        setReady(!!instance);
      })
      .catch((error: unknown) => {
        // Decoration failure must never block the server-rendered recovery links.
        console.warn('Portfolio particles could not initialize.', error);
      });
    return () => {
      cancelled = true;
      visibility?.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
      instance?.destroy();
      container.current = undefined;
    };
  }, [settings.enabled, settings.interactive, settings.dark, variant]);

  function toggle() {
    const next = !paused;
    pausedRef.current = next;
    setPaused(next);
    if (next) container.current?.pause();
    else if (inViewport.current && !document.hidden) container.current?.play();
  }

  return (
    <>
      <div
        ref={element}
        className={variant === 'hero' ? styles.sideCanvas : styles.canvas}
        aria-hidden="true"
      />
      {ready && variant === 'not-found' && (
        <button type="button" className={styles.control} onClick={toggle}>
          {paused ? 'Resume particles' : 'Pause particles'}
        </button>
      )}
    </>
  );
}
