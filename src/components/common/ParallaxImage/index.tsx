'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionStyle } from 'motion/react';
import { useScrollMotion } from '@/lib/hooks/use-scroll-motion';
import type { ParallaxImageProps } from './type';
import './style.css';

export function ParallaxImage({ children, travel = 1 }: ParallaxImageProps) {
  const frame = useRef<HTMLDivElement>(null);
  const enabled = useScrollMotion();
  const { scrollYProgress } = useScroll({ target: frame, offset: ['start end', 'end start'] });
  // An oversized image plane covers the frame throughout its bounded travel.
  const travelDistance = `${travel}rem`;
  const y = useTransform(scrollYProgress, [0, 1], [travelDistance, `-${travel}rem`]);
  return (
    <div ref={frame} className="parallax-image">
      <motion.div
        className="parallax-image-plane"
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
