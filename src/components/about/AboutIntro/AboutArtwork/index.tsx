'use client';

import Image from 'next/image';
import { useEffect, useRef, type PointerEvent } from 'react';
import artwork from '@public/images/about-chip.webp';
import type { AboutScene } from './AboutScene';
import type { DragState } from './type';
import styles from './style.module.css';

export function AboutArtwork() {
  const frame = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<AboutScene | null>(null);
  const rotation = useRef(0);
  const velocity = useRef(0);
  const drag = useRef<DragState | null>(null);
  function rotate(value: number) {
    const next = Math.max(-180, Math.min(180, value));
    rotation.current = next;
    if (canvasHost.current) {
      canvasHost.current.dataset.rotation = String(next);
    }
    sceneRef.current?.setRotation((next * Math.PI) / 180);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (frame.current?.dataset.scene !== 'ready' || !event.isPrimary || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    velocity.current = 0;
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      rotation: rotation.current,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    };
    event.currentTarget.dataset.dragging = 'true';
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) {
      const distance = event.clientX - drag.current.lastX;
      const duration = event.timeStamp - drag.current.lastTime;
      if (distance !== 0 && duration > 0) {
        const speed = Math.max(-240, Math.min(240, (distance * 700) / duration));
        drag.current.velocity = drag.current.velocity * 0.5 + speed * 0.5;
        drag.current.lastX = event.clientX;
        drag.current.lastTime = event.timeStamp;
      }
      rotate(drag.current.rotation + (event.clientX - drag.current.x) * 0.7);
    }
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) {
      velocity.current =
        event.type === 'pointerup' && event.timeStamp - drag.current.lastTime < 100
          ? drag.current.velocity
          : 0;
      drag.current = null;
      delete event.currentTarget.dataset.dragging;
    }
  }

  useEffect(() => {
    const currentFrame = frame.current;
    const currentHost = canvasHost.current;
    if (
      !currentFrame ||
      !currentHost ||
      !('IntersectionObserver' in window) ||
      !('ResizeObserver' in window)
    ) {
      return;
    }
    const element = currentFrame;
    const host = currentHost;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let disposed = false;
    let loading = false;
    let failed = false;
    let animationFrame = 0;
    let previousTime = 0;
    let elapsed = 0;
    let scene: AboutScene | undefined;

    function stop() {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      previousTime = 0;
    }

    function tick(time: number) {
      if (!visible || reducedMotion.matches || document.hidden || !scene) {
        stop();
        return;
      }
      if (!previousTime || time - previousTime >= 1000 / 30) {
        const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.1) : 0;
        elapsed += delta;
        previousTime = time;
        if (!drag.current && velocity.current !== 0 && delta > 0) {
          const damping = Math.exp(-3.5 * delta);
          const next = Math.max(
            -180,
            Math.min(180, rotation.current + (velocity.current * (1 - damping)) / 3.5),
          );
          rotation.current = next;
          velocity.current *= damping;
          scene.setRotation((next * Math.PI) / 180);
          host.dataset.rotation = String(next);
          if (Math.abs(velocity.current) < 1 || Math.abs(next) === 180) {
            velocity.current = 0;
          }
        }
        scene.render(elapsed);
      }
      animationFrame = requestAnimationFrame(tick);
    }

    async function start() {
      if (disposed || failed || loading || !visible || reducedMotion.matches || document.hidden) {
        return;
      }
      if (!scene) {
        loading = true;
        try {
          const { createAboutScene } = await import('./AboutScene');
          if (disposed || !visible || reducedMotion.matches || document.hidden) {
            return;
          }
          scene = createAboutScene(host);
          sceneRef.current = scene;
          scene.setRotation((rotation.current * Math.PI) / 180);
          scene.canvas.addEventListener('webglcontextlost', onContextLost);
          scene.resize();
        } catch {
          scene?.dispose();
          scene = undefined;
          sceneRef.current = null;
          failed = true;
          element.dataset.scene = 'fallback';
          return;
        } finally {
          loading = false;
        }
      }
      if (!disposed && visible && !reducedMotion.matches && !document.hidden) {
        element.dataset.scene = 'ready';
        if (!animationFrame) {
          animationFrame = requestAnimationFrame(tick);
        }
      }
    }

    function onContextLost() {
      failed = true;
      stop();
      element.dataset.scene = 'fallback';
    }

    function sync() {
      if (reducedMotion.matches) {
        element.dataset.scene = 'fallback';
        drag.current = null;
        delete host.dataset.dragging;
      }
      if (!visible || reducedMotion.matches || document.hidden) {
        if (velocity.current !== 0) {
          velocity.current = 0;
        }
        stop();
      } else {
        void start();
      }
    }

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const resize = new ResizeObserver(() => scene?.resize());
    intersection.observe(element);
    resize.observe(host);
    reducedMotion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      disposed = true;
      stop();
      intersection.disconnect();
      resize.disconnect();
      reducedMotion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      scene?.canvas.removeEventListener('webglcontextlost', onContextLost);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div ref={frame} className={styles.artwork} data-scene="fallback" aria-hidden="true">
      <Image src={artwork} alt="" sizes="(min-width: 64rem) 32rem, (min-width: 48rem) 38vw, 90vw" />
      <div
        ref={canvasHost}
        className={styles.canvas}
        data-native-cursor
        data-rotation="0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      />
    </div>
  );
}
