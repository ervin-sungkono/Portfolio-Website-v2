'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { useScrollMotion } from '@/lib/hooks/use-scroll-motion';
import { activeSlideForProgress, slideOpacityForProgress } from './progress';
import type { ScrollHeroProps } from './type';
import './style.css';

function HeroSlide({
  children,
  index,
  count,
  progress,
  active,
  hold,
  onFocus,
  onBlur,
}: {
  children: ReactNode;
  index: number;
  count: number;
  progress: MotionValue<number>;
  active: boolean;
  hold: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const opacity = useTransform(progress, (value) => slideOpacityForProgress(value, index, count));
  return (
    <motion.div
      data-hero-slide={index}
      data-hero-screenshot={index === 0 ? '' : undefined}
      data-hero-placeholder={index === 1 ? '' : undefined}
      aria-hidden={!active}
      inert={!active}
      className="scroll-hero-slide"
      onFocusCapture={onFocus}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onBlur();
        }
      }}
      style={{ opacity: hold ? Number(active) : opacity, pointerEvents: active ? 'auto' : 'none' }}
    >
      {children}
    </motion.div>
  );
}

export function ScrollHero({ children, slides }: ScrollHeroProps) {
  const scene = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const enabled = useScrollMotion();
  const [fits, setFits] = useState(false);
  const pinned = enabled && fits && slides.length > 1;
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [focusedSlide, setFocusedSlide] = useState<number | null>(null);
  const { scrollYProgress } = useScroll({
    target: scene,
    offset: ['start start', 'end end'],
    trackContentSize: true,
  });
  const activeSlide = Math.min(focusedSlide ?? (pinned ? selectedSlide : 0), slides.length - 1);
  const holdVisual = !pinned || focusedSlide !== null;

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const active = activeSlideForProgress(progress, slides.length);
    if (active !== selectedSlide) {
      setSelectedSlide(active);
    }
  });

  useEffect(() => {
    const element = stage.current;
    if (!element) {
      return;
    }
    function measure() {
      const current = stage.current;
      if (!current) {
        return;
      }
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
    <div
      ref={scene}
      className="scroll-hero"
      data-scroll-scene
      data-pinned={pinned}
      style={
        { '--scroll-hero-travel': `${Math.max(0, slides.length - 1) * 50}svh` } as CSSProperties
      }
    >
      <section ref={stage} className="hero scroll-hero-stage">
        <div data-parallax="copy">{children}</div>
        <div data-parallax="visual" className="scroll-hero-visual-stack">
          {slides.length === 0 && <p>Featured projects will appear here.</p>}
          {slides.map((slide, index) => (
            <HeroSlide
              key={slide.id}
              index={index}
              count={slides.length}
              progress={scrollYProgress}
              active={activeSlide === index}
              hold={holdVisual}
              onFocus={() => setFocusedSlide(index)}
              onBlur={() => setFocusedSlide(null)}
            >
              {slide.content}
            </HeroSlide>
          ))}
        </div>
      </section>
    </div>
  );
}
