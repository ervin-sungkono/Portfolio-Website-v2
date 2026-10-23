'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { useScrollMotion } from '@/lib/hooks/use-scroll-motion';
import type { ScrollHeroProps } from './type';
import './style.css';

export function ScrollHero({ copy, visual, nextVisual }: ScrollHeroProps) {
  const scene = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const enabled = useScrollMotion();
  const [fits, setFits] = useState(false);
  const pinned = enabled && fits;
  const [nextActive, setNextActive] = useState(false);
  const [focusedSlide, setFocusedSlide] = useState<0 | 1 | null>(null);
  const { scrollYProgress } = useScroll({
    target: scene,
    offset: ['start start', 'end end'],
    trackContentSize: true,
  });
  // Hold each project long enough to read; crossfade through the middle of the scene.
  const firstOpacity = useTransform(scrollYProgress, [0.2, 0.8], [1, 0]);
  const nextOpacity = useTransform(scrollYProgress, [0.2, 0.8], [0, 1]);
  const showNext = focusedSlide === null ? pinned && nextActive : focusedSlide === 1;
  const holdVisual = !pinned || focusedSlide !== null;
  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const active = progress >= 0.5;
    // Only the project boundary updates React; continuous fading uses Motion values.
    if (active !== nextActive) setNextActive(active);
  });

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    function measure() {
      const current = stage.current;
      if (!current) return;
      const header = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
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
    <div ref={scene} className="scroll-hero" data-scroll-scene data-pinned={pinned}>
      <section ref={stage} className="hero scroll-hero-stage">
        <div data-parallax="copy">{copy}</div>
        <div data-parallax="visual" className="scroll-hero-visual-stack">
          <motion.div
            data-hero-screenshot
            aria-hidden={showNext}
            inert={showNext}
            className="scroll-hero-slide"
            onFocusCapture={() => setFocusedSlide(0)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setFocusedSlide(null);
            }}
            style={{
              opacity: holdVisual ? Number(!showNext) : firstOpacity,
              pointerEvents: showNext ? 'none' : 'auto',
            }}
          >
            {visual}
          </motion.div>
          <motion.div
            data-hero-placeholder
            aria-hidden={!showNext}
            inert={!showNext}
            className="scroll-hero-slide"
            onFocusCapture={() => setFocusedSlide(1)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setFocusedSlide(null);
            }}
            style={{
              opacity: holdVisual ? Number(showNext) : nextOpacity,
              pointerEvents: showNext ? 'auto' : 'none',
            }}
          >
            {nextVisual}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
