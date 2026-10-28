'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, transform, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { useScrollMotion } from '@/lib/hooks/use-scroll-motion';
import type { ScrollHeroProps } from './type';
import './style.css';

const mobileScrollMotionQuery =
  '(width < 64rem) and (height >= 36rem) and (pointer: coarse) and (prefers-reduced-motion: no-preference)';

export function ScrollHero({ copy, visual, nextVisual }: ScrollHeroProps) {
  const scene = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const visualScene = useRef<HTMLDivElement>(null);
  const visualStack = useRef<HTMLDivElement>(null);
  const enabled = useScrollMotion();
  const mobileEnabled = useScrollMotion(mobileScrollMotionQuery);
  const [layout, setLayout] = useState({
    desktopFits: false,
    mobileFits: false,
    header: 0,
    preview: 0,
  });
  const pinned = enabled && layout.desktopFits;
  const mobilePinned = mobileEnabled && layout.mobileFits;
  const isPinned = pinned || mobilePinned;
  const [nextActive, setNextActive] = useState(false);
  const [focusedSlide, setFocusedSlide] = useState<0 | 1 | null>(null);
  const { scrollYProgress } = useScroll({
    target: mobilePinned ? visualScene : scene,
    offset: mobilePinned
      ? [`start ${layout.header}px`, `end ${layout.header + layout.preview}px`]
      : ['start start', 'end end'],
    trackContentSize: true,
  });
  // A function transform avoids retaining a native timeline when mobile pixel offsets change.
  const firstOpacity = useTransform(scrollYProgress, (progress) =>
    transform(progress, [0.2, 0.8], [1, 0]),
  );
  const nextOpacity = useTransform(firstOpacity, (opacity) => 1 - opacity);
  const showNext = focusedSlide === null ? isPinned && nextActive : focusedSlide === 1;
  const holdVisual = !isPinned || focusedSlide !== null;
  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const active = progress >= 0.5;
    // Only the project boundary updates React; continuous fading uses Motion values.
    if (active !== nextActive) {
      setNextActive(active);
    }
  });

  useEffect(() => {
    const element = stage.current;
    const preview = visualStack.current;
    if (!element || !preview) {
      return;
    }
    const header = document.querySelector('.site-header');
    function measure() {
      const current = stage.current;
      const currentPreview = visualStack.current;
      if (!current || !currentPreview) {
        return;
      }
      const headerHeight = header?.getBoundingClientRect().height || 0;
      const previewHeight = currentPreview.getBoundingClientRect().height;
      const availableHeight = window.innerHeight - headerHeight;
      setLayout({
        desktopFits: current.offsetHeight <= availableHeight + 1,
        mobileFits: previewHeight > 0 && previewHeight <= availableHeight + 1,
        header: headerHeight,
        preview: previewHeight,
      });
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(preview);
    if (header) {
      observer.observe(header);
    }
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
      data-mobile-pinned={mobilePinned}
    >
      <section ref={stage} className="hero scroll-hero-stage">
        <div data-parallax="copy">{copy}</div>
        <div ref={visualScene} className="scroll-hero-visual-scene">
          <div ref={visualStack} data-parallax="visual" className="scroll-hero-visual-stack">
            <motion.div
              data-hero-screenshot
              aria-hidden={showNext}
              inert={showNext}
              className="scroll-hero-slide"
              onFocusCapture={() => setFocusedSlide(0)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setFocusedSlide(null);
                }
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
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setFocusedSlide(null);
                }
              }}
              style={{
                opacity: holdVisual ? Number(showNext) : nextOpacity,
                pointerEvents: showNext ? 'auto' : 'none',
              }}
            >
              {nextVisual}
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
