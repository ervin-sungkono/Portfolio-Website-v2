'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useScrollMotion } from './use-scroll-motion';
import styles from './motion.module.css';

export function ScrollHero({ copy, visual }: { copy: ReactNode; visual: ReactNode }) {
  const scene = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const enabled = useScrollMotion();
  const [fits, setFits] = useState(false);
  const pinned = enabled && fits;
  const { scrollYProgress } = useScroll({
    target: scene,
    offset: ['start start', 'end end'],
    trackContentSize: true,
  });
  const copyY = useTransform(scrollYProgress, [0, 1], ['0rem', '-1rem']);
  const visualY = useTransform(scrollYProgress, [0, 1], ['0rem', '-3rem']);
  const visualScale = useTransform(scrollYProgress, [0, 1], [1, 1.04]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    function measure() {
      const current = stage.current;
      if (!current) return;
      const header = document.querySelector('header')?.getBoundingClientRect().height || 0;
      setFits(current.offsetHeight <= window.innerHeight - header + 1);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div ref={scene} className={styles.heroScene} data-scroll-scene data-pinned={pinned}>
      <section ref={stage} className={`hero ${styles.heroStage}`}>
        <motion.div data-parallax="copy" style={{ y: pinned ? copyY : 0 }}>
          {copy}
        </motion.div>
        <motion.div
          data-parallax="visual"
          style={{ y: pinned ? visualY : 0, scale: pinned ? visualScale : 1 }}
        >
          {visual}
        </motion.div>
      </section>
    </div>
  );
}
