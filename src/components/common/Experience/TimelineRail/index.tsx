'use client';

import { motion, useScroll } from 'motion/react';
import { useRef } from 'react';
import { useScrollMotion } from '@/lib/hooks/use-scroll-motion';
import './style.css';

export function TimelineRail() {
  const rail = useRef<HTMLSpanElement>(null);
  const enabled = useScrollMotion();
  const { scrollYProgress } = useScroll({ target: rail, offset: ['start end', 'end center'] });

  return (
    <span ref={rail} className="experience-section-timeline-rail" aria-hidden="true">
      <motion.span
        className="experience-section-timeline-progress"
        style={{ scaleY: enabled ? scrollYProgress : 0 }}
      />
    </span>
  );
}
