'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue } from 'motion/react';
import styles from './motion.module.css';

export default function DesktopCursor() {
  const [mode, setMode] = useState<'idle' | 'link' | 'project'>('idle');
  const hoverScale = useRef(1);
  // Direct values keep the reticle at the pointer without spring lag.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(0);

  useEffect(() => {
    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse') {
        opacity.set(0);
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
        opacity.set(0);
        return;
      }
      x.set(event.clientX);
      y.set(event.clientY);
      opacity.set(1);
    }
    function over(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;
      const target = event.target instanceof Element ? event.target : null;
      const next = target?.closest('[data-cursor="project"]')
        ? 'project'
        : target?.closest('a, button')
          ? 'link'
          : 'idle';
      setMode(next);
      hoverScale.current = next === 'link' ? 1.2 : 1;
      scale.set(hoverScale.current);
    }
    function hide() {
      opacity.set(0);
      scale.set(hoverScale.current);
    }
    function down() {
      scale.set(hoverScale.current * 0.8);
    }
    function up() {
      scale.set(hoverScale.current);
    }
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointercancel', hide);
    document.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', hide);
      document.removeEventListener('pointerleave', hide);
      window.removeEventListener('blur', hide);
    };
  }, [x, y, scale, opacity]);

  return (
    <motion.div aria-hidden="true" className={styles.cursor} style={{ x, y, opacity }}>
      <motion.div className={styles.cursorFeedback} style={{ scale }}>
        <div className={styles.cursorReticle} data-mode={mode}>
          {[0, 1, 2, 3].map((corner) => (
            <span key={corner} className={styles.cursorCorner} />
          ))}
          {mode === 'project' && <span className={styles.cursorLabel}>View ↗</span>}
        </div>
      </motion.div>
    </motion.div>
  );
}
