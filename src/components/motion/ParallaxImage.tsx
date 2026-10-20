'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform, type MotionStyle } from 'motion/react';
import { useScrollMotion } from './use-scroll-motion';
import styles from './motion.module.css';

export function ParallaxImage({
  children,
  travel = 1,
}: {
  children: ReactNode;
  travel?: 1 | 1.25 | 1.5 | 2;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const enabled = useScrollMotion();
  const { scrollYProgress } = useScroll({ target: frame, offset: ['start end', 'end start'] });
  // An oversized image plane covers the frame throughout its bounded travel.
  const travelDistance = `${travel}rem`;
  const y = useTransform(scrollYProgress, [0, 1], [travelDistance, `-${travel}rem`]);
  return (
    <div ref={frame} className={styles.parallaxFrame}>
      <motion.div
        className={styles.parallaxPlane}
        data-parallax="image"
        data-parallax-active={enabled}
        data-parallax-travel={travel}
        style={{ y: enabled ? y : 0, '--parallax-travel': travelDistance } as MotionStyle}
      >
        {children}
      </motion.div>
    </div>
  );
}
