'use client';

import { motion, useReducedMotion, useSpring } from 'motion/react';
import { useRef } from 'react';
import type { PointerSurfaceProps, SurfacePointerEvent } from './type';
import './style.css';

const spring = { stiffness: 180, damping: 24, mass: 0.5 };

export function PointerSurface({ children, className }: PointerSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const rotateX = useSpring(0, spring);
  const rotateY = useSpring(0, spring);

  function reset() {
    rotateX.set(0);
    rotateY.set(0);
  }
  function onMove(event: SurfacePointerEvent) {
    if (
      reduceMotion !== false ||
      event.pointerType !== 'mouse' ||
      !window.matchMedia('(min-width: 64rem) and (hover: hover) and (pointer: fine)').matches
    )
      return;
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = Math.max(-0.5, Math.min(0.5, (event.clientX - bounds.left) / bounds.width - 0.5));
    const y = Math.max(-0.5, Math.min(0.5, (event.clientY - bounds.top) / bounds.height - 0.5));
    rotateX.set(-y * 8);
    rotateY.set(x * 8);
  }

  return (
    <motion.div
      ref={ref}
      className={`pointer-surface ${className || ''}`}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onBlur={reset}
    >
      {children}
    </motion.div>
  );
}
