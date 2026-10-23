'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue } from 'motion/react';
import type { FrameBounds } from './type';
import './style.css';

const CURSOR_MEDIA_QUERY =
  '(min-width: 64rem) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';
const FRAME_MORPH_DURATION = 160;
const IDLE_FRAME_SIZE = 32;
const HOVER_FRAME_GAP = 8;
const INTERACTIVE_SELECTOR = 'a[href], button, [role="button"], [data-cursor]';

function isNativeCursorRegion(element: Element) {
  if (element.closest('input, textarea, select, iframe')) return true;
  const editable = element.closest('[contenteditable]');
  return editable !== null && editable.getAttribute('contenteditable')?.toLowerCase() !== 'false';
}

function isUnavailable(element: Element) {
  return element.closest(':disabled, [disabled], [aria-disabled="true"]') !== null;
}

function getInteractiveTarget(element: Element) {
  const target = element.closest(INTERACTIVE_SELECTOR);
  if (!target || isUnavailable(target)) return null;
  return target;
}

export default function DesktopCursor() {
  const overlay = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const frameX = useMotionValue(-IDLE_FRAME_SIZE / 2);
  const frameY = useMotionValue(-IDLE_FRAME_SIZE / 2);
  const frameWidth = useMotionValue(IDLE_FRAME_SIZE);
  const frameHeight = useMotionValue(IDLE_FRAME_SIZE);
  const opacity = useMotionValue(0);

  useEffect(() => {
    const media = window.matchMedia(CURSOR_MEDIA_QUERY);
    const root = document.documentElement;
    let visible = false;
    let clientX = 0;
    let clientY = 0;
    let frameId = 0;
    let target: Element | null = null;
    let morphing = false;
    let morphStartedAt = 0;
    let morphFrom: FrameBounds = {
      x: -IDLE_FRAME_SIZE / 2,
      y: -IDLE_FRAME_SIZE / 2,
      width: IDLE_FRAME_SIZE,
      height: IDLE_FRAME_SIZE,
    };

    function stopTracking() {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
    }

    function currentFrame(): FrameBounds {
      return {
        x: frameX.get(),
        y: frameY.get(),
        width: frameWidth.get(),
        height: frameHeight.get(),
      };
    }

    function setFrame(bounds: FrameBounds) {
      frameX.set(bounds.x);
      frameY.set(bounds.y);
      frameWidth.set(bounds.width);
      frameHeight.set(bounds.height);
    }

    function idleBounds(): FrameBounds {
      return {
        x: clientX - IDLE_FRAME_SIZE / 2,
        y: clientY - IDLE_FRAME_SIZE / 2,
        width: IDLE_FRAME_SIZE,
        height: IDLE_FRAME_SIZE,
      };
    }

    function setHovered(hovered: boolean) {
      overlay.current?.setAttribute('data-cursor-hovered', String(hovered));
    }

    function restoreNativeCursor() {
      if (!visible) return;
      visible = false;
      target = null;
      setHovered(false);
      morphing = false;
      stopTracking();
      opacity.set(0);
      if (root.hasAttribute('data-custom-cursor')) {
        root.removeAttribute('data-custom-cursor');
        root.classList.remove('desktop-cursor-active');
      }
    }

    function updateFrame(nextTarget: Element | null, destination: FrameBounds) {
      if (nextTarget !== target) {
        target = nextTarget;
        setHovered(nextTarget !== null);
        morphFrom = currentFrame();
        morphStartedAt = performance.now();
        morphing = true;
      }

      if (morphing) {
        const progress = Math.min(1, (performance.now() - morphStartedAt) / FRAME_MORPH_DURATION);
        const eased = 1 - (1 - progress) ** 3;
        setFrame({
          x: morphFrom.x + (destination.x - morphFrom.x) * eased,
          y: morphFrom.y + (destination.y - morphFrom.y) * eased,
          width: morphFrom.width + (destination.width - morphFrom.width) * eased,
          height: morphFrom.height + (destination.height - morphFrom.height) * eased,
        });
        if (progress >= 1) morphing = false;
      } else {
        setFrame(destination);
      }

      return morphing || target !== null;
    }

    function syncFrameToHitTarget() {
      if (!visible) return false;

      const hit = document.elementFromPoint(clientX, clientY);
      if (hit && (isNativeCursorRegion(hit) || isUnavailable(hit))) {
        restoreNativeCursor();
        return false;
      }

      const nextTarget = hit ? getInteractiveTarget(hit) : null;
      if (nextTarget) {
        const bounds = nextTarget.getBoundingClientRect();
        if (bounds.width > 0 && bounds.height > 0) {
          return updateFrame(nextTarget, {
            x: bounds.left - HOVER_FRAME_GAP,
            y: bounds.top - HOVER_FRAME_GAP,
            width: bounds.width + HOVER_FRAME_GAP * 2,
            height: bounds.height + HOVER_FRAME_GAP * 2,
          });
        }
      }

      return updateFrame(null, idleBounds());
    }

    function trackTarget() {
      frameId = 0;
      if (syncFrameToHitTarget()) {
        frameId = window.requestAnimationFrame(trackTarget);
      }
    }

    function refreshAtPointer() {
      if (syncFrameToHitTarget()) {
        if (!frameId) frameId = window.requestAnimationFrame(trackTarget);
      } else {
        stopTracking();
      }
    }

    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse' || !media.matches) {
        restoreNativeCursor();
        return;
      }

      clientX = event.clientX;
      clientY = event.clientY;
      pointerX.set(clientX);
      pointerY.set(clientY);
      const wasVisible = visible;
      if (!visible) {
        target = null;
        morphing = false;
        setFrame(idleBounds());
      }
      visible = true;
      refreshAtPointer();
      if (visible && !wasVisible) {
        opacity.set(1);
        root.setAttribute('data-custom-cursor', 'active');
        root.classList.add('desktop-cursor-active');
      }
    }

    function over(event: PointerEvent) {
      if (event.pointerType === 'mouse' && visible) refreshAtPointer();
    }

    function out(event: PointerEvent) {
      if (event.relatedTarget === null || event.relatedTarget instanceof HTMLIFrameElement)
        restoreNativeCursor();
    }

    function viewportChanged() {
      if (visible) refreshAtPointer();
    }

    function mediaChanged() {
      if (!media.matches) restoreNativeCursor();
    }

    function visibilityChanged() {
      if (document.visibilityState !== 'visible') restoreNativeCursor();
    }

    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('pointerout', out, { passive: true });
    document.addEventListener('pointerleave', restoreNativeCursor);
    document.addEventListener('pointercancel', restoreNativeCursor);
    document.addEventListener('scroll', viewportChanged, { capture: true, passive: true });
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('resize', viewportChanged, { passive: true });
    window.addEventListener('blur', restoreNativeCursor);
    media.addEventListener('change', mediaChanged);

    return () => {
      stopTracking();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('pointerleave', restoreNativeCursor);
      document.removeEventListener('pointercancel', restoreNativeCursor);
      document.removeEventListener('scroll', viewportChanged, true);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('resize', viewportChanged);
      window.removeEventListener('blur', restoreNativeCursor);
      media.removeEventListener('change', mediaChanged);
      root.removeAttribute('data-custom-cursor');
      root.classList.remove('desktop-cursor-active');
    };
  }, [frameHeight, frameWidth, frameX, frameY, opacity, pointerX, pointerY]);

  return (
    <div
      ref={overlay}
      aria-hidden="true"
      className="desktop-cursor"
      data-desktop-cursor=""
      data-cursor-hovered="false"
    >
      <motion.div
        className="desktop-cursor-frame"
        data-cursor-frame=""
        style={{ x: frameX, y: frameY, width: frameWidth, height: frameHeight, opacity }}
      >
        {[0, 1, 2, 3].map((corner) => (
          <span key={corner} className="desktop-cursor-corner" />
        ))}
      </motion.div>
      <motion.div
        className="desktop-cursor-dot"
        data-cursor-dot=""
        style={{ x: pointerX, y: pointerY, opacity }}
      />
    </div>
  );
}
