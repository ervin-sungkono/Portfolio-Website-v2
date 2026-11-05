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
import {
  activeSlideForProgress,
  nearestSlideForProgress,
  slideAnchorProgress,
  slideOpacityForProgress,
  slideTransformForProgress,
} from './progress';
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
  const transform = useTransform(progress, (value) =>
    slideTransformForProgress(value, index, count),
  );
  return (
    <motion.div
      data-hero-slide={index}
      data-hero-screenshot={index === 0 ? '' : undefined}
      aria-hidden={!active}
      inert={!active}
      className="scroll-hero-slide"
      onFocusCapture={onFocus}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onBlur();
        }
      }}
      style={{
        opacity: hold ? Number(active) : opacity,
        transform: hold ? 'translate3d(0, 0, 0) rotate(0deg)' : transform,
        pointerEvents: active ? 'auto' : 'none',
      }}
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

  useEffect(() => {
    const element = scene.current;
    if (!element || !pinned || focusedSlide !== null || slides.length < 2) {
      return;
    }
    const sceneElement = element;

    const wheelIdleDelay = 220;
    let settleTimer: number | undefined;
    let wheelDirection = 0;
    let settleTarget: number | null = null;

    function stopSettling() {
      if (settleTimer !== undefined) {
        window.clearTimeout(settleTimer);
        settleTimer = undefined;
      }
      wheelDirection = 0;
      if (settleTarget !== null) {
        window.scrollTo({ top: window.scrollY, behavior: 'instant' });
        settleTarget = null;
      }
    }

    function settleNearestSlide() {
      settleTimer = undefined;
      const direction = wheelDirection;
      wheelDirection = 0;
      if (direction === 0) {
        return;
      }

      const bounds = sceneElement.getBoundingClientRect();
      const start = bounds.top + window.scrollY;
      const end = bounds.bottom + window.scrollY - window.innerHeight;
      const travel = end - start;
      const current = window.scrollY;
      if (travel <= 0 || current < start - 1 || current > end + 1) {
        return;
      }

      const progress = (current - start) / travel;
      const firstAnchor = slideAnchorProgress(0, slides.length);
      const lastAnchor = slideAnchorProgress(slides.length - 1, slides.length);
      if ((direction > 0 && progress > lastAnchor) || (direction < 0 && progress < firstAnchor)) {
        return;
      }

      const nearestSlide = nearestSlideForProgress(progress, slides.length);
      const target = start + slideAnchorProgress(nearestSlide, slides.length) * travel;
      if (Math.abs(target - current) > 2) {
        settleTarget = target;
        window.scrollTo({ top: target, behavior: 'smooth' });
      }
    }

    function onWheel(event: WheelEvent) {
      if (settleTimer !== undefined || settleTarget !== null) {
        stopSettling();
      }
      if (event.deltaY === 0 || event.ctrlKey) {
        return;
      }
      wheelDirection = Math.sign(event.deltaY);
      settleTimer = window.setTimeout(settleNearestSlide, wheelIdleDelay);
    }

    function onScrollEnd() {
      settleTarget = null;
    }

    window.addEventListener('wheel', onWheel, { capture: true, passive: true });
    window.addEventListener('keydown', stopSettling, true);
    window.addEventListener('pointerdown', stopSettling, true);
    window.addEventListener('touchstart', stopSettling, { capture: true, passive: true });
    window.addEventListener('scrollend', onScrollEnd);

    return () => {
      stopSettling();
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('keydown', stopSettling, true);
      window.removeEventListener('pointerdown', stopSettling, true);
      window.removeEventListener('touchstart', stopSettling, true);
      window.removeEventListener('scrollend', onScrollEnd);
    };
  }, [focusedSlide, pinned, slides.length]);

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
