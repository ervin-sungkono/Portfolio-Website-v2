'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useScrollMotion } from './use-scroll-motion';
import styles from './motion.module.css';

export function ParallaxImage({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const enabled = useScrollMotion();
  const { scrollYProgress } = useScroll({ target: frame, offset: ['start end', 'end start'] });
  // The frame padding contains the travel, preserving the screenshot's full view.
  const y = useTransform(scrollYProgress, [0, 1], ['1rem', '-1rem']);
  return (
    <div ref={frame} className={styles.parallaxFrame}>
      <motion.div
        className={styles.parallaxPlane}
        data-parallax="image"
        style={{ y: enabled ? y : 0 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
