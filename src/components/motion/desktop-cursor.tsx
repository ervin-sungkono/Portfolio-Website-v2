'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import styles from './motion.module.css';

export default function DesktopCursor() {
  const [mode, setMode] = useState<'idle' | 'link' | 'project'>('idle');
  const positioned = useRef(false);
  const hoverScale = useRef(1);
  const x = useSpring(0, { stiffness: 450, damping: 35, mass: 0.4 });
  const y = useSpring(0, { stiffness: 450, damping: 35, mass: 0.4 });
  const scale = useSpring(1, { stiffness: 300, damping: 25 });
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
      if (!positioned.current) {
        x.jump(event.clientX);
        y.jump(event.clientY);
        positioned.current = true;
      } else {
        x.set(event.clientX);
        y.set(event.clientY);
      }
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
      hoverScale.current = next === 'project' ? 1.5 : next === 'link' ? 1.2 : 1;
      scale.set(hoverScale.current);
    }
    function hide() {
      opacity.set(0);
      positioned.current = false;
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
      <motion.div className={styles.cursorRing} data-mode={mode} style={{ scale }}>
        {mode === 'project' && <span>View</span>}
      </motion.div>
    </motion.div>
  );
}
