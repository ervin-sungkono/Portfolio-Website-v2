'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useScrollMotion } from '@/lib/hooks/use-scroll-motion';
import type { ScrollHeroProps } from './type';
import './style.css';

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function slideScrollRange(scene: HTMLElement, stage: HTMLElement, count: number) {
  const bounds = scene.getBoundingClientRect();
  const stickyTop = Number.parseFloat(getComputedStyle(stage).top) || 0;
  const start = Math.max(0, bounds.top + window.scrollY - stickyTop);
  const end = Math.max(start, bounds.bottom + window.scrollY - window.innerHeight);
  return { start, end, step: (end - start) / Math.max(1, count - 1) };
}

export function ScrollHero({ children, slides }: ScrollHeroProps) {
  const scene = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const slideStack = useRef<HTMLDivElement>(null);
  const keyboardHintId = useId();
  const selectedSlideRef = useRef(0);
  const targetSlideRef = useRef<number | null>(null);
  const enabled = useScrollMotion();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [fits, setFits] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [focusedSlide, setFocusedSlide] = useState<number | null>(null);
  const pinned = enabled && fits && slides.length > 1;
  const activeSlide = Math.max(0, Math.min(focusedSlide ?? selectedSlide, slides.length - 1));
  const { scrollYProgress } = useScroll({
    target: scene,
    offset: ['start start', 'end end'],
    trackContentSize: true,
  });
  const parallaxOffset = useTransform(scrollYProgress, [0, 1], [0, -14]);

  const updateSelectedSlide = useCallback((index: number) => {
    if (selectedSlideRef.current !== index) {
      selectedSlideRef.current = index;
      setSelectedSlide(index);
    }
  }, []);

  const goToSlide = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(slides.length - 1, index));
      if (!pinned || !scene.current || !stage.current) {
        updateSelectedSlide(next);
        slideStack.current?.children.item(next)?.scrollIntoView({
          behavior: enabled ? 'smooth' : 'instant',
          block: 'nearest',
          inline: 'start',
        });
        return;
      }
      const { start, step } = slideScrollRange(scene.current, stage.current, slides.length);
      const top = start + step * next;
      if (step <= 0 || Math.abs(window.scrollY - top) < 1) {
        targetSlideRef.current = null;
        updateSelectedSlide(next);
        return;
      }
      targetSlideRef.current = next;
      window.scrollTo({ top, behavior: 'smooth' });
    },
    [enabled, pinned, slides.length, updateSelectedSlide],
  );

  useEffect(() => {
    const element = stage.current;
    if (!element) {
      return;
    }
    const stageElement = element;
    function measure() {
      const header = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
      setFits(stageElement.offsetHeight <= window.innerHeight - header + 1);
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
    const stageElement = stage.current;
    if (!element || !stageElement || !pinned) {
      return;
    }
    const sceneElement = element;
    const heroStage = stageElement;
    let wheelTimer: number | undefined;
    let scrollTimer: number | undefined;

    function syncSlide() {
      const { start, step } = slideScrollRange(sceneElement, heroStage, slides.length);
      if (step > 0) {
        const index = Math.max(
          0,
          Math.min(slides.length - 1, Math.round((window.scrollY - start) / step)),
        );
        updateSelectedSlide(index);
      }
    }

    function clearTarget() {
      window.clearTimeout(scrollTimer);
      scrollTimer = undefined;
      targetSlideRef.current = null;
      syncSlide();
    }

    function cancelMotion() {
      window.clearTimeout(wheelTimer);
      wheelTimer = undefined;
      if (targetSlideRef.current !== null) {
        window.scrollTo({ top: window.scrollY, behavior: 'instant' });
      }
      clearTarget();
    }

    function onWheel(event: WheelEvent) {
      if (event.ctrlKey) {
        cancelMotion();
        return;
      }
      if (
        event.defaultPrevented ||
        !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        !(event.target instanceof Element)
      ) {
        return;
      }
      const withinScene = sceneElement.contains(event.target);
      const stageBounds = heroStage.getBoundingClientRect();
      const withinGutter =
        event.target.contains(sceneElement) &&
        event.clientY >= stageBounds.top &&
        event.clientY <= stageBounds.bottom;
      if (focusedSlide !== null || (!withinScene && !withinGutter)) {
        cancelMotion();
        return;
      }
      for (
        let target: Element | null = withinScene ? event.target : null;
        target && target !== sceneElement;
        target = target.parentElement
      ) {
        if (!(target instanceof HTMLElement)) {
          continue;
        }
        const overflow = getComputedStyle(target).overflowY;
        const canScroll =
          event.deltaY > 0
            ? target.scrollTop + target.clientHeight < target.scrollHeight - 1
            : target.scrollTop > 0;
        if (canScroll && ['auto', 'scroll', 'overlay'].includes(overflow)) {
          cancelMotion();
          return;
        }
      }

      const { start, end, step } = slideScrollRange(sceneElement, heroStage, slides.length);
      if (step <= 0 || window.scrollY < start - 1 || window.scrollY > end + 1) {
        return;
      }
      if (wheelTimer !== undefined) {
        event.preventDefault();
        window.clearTimeout(wheelTimer);
      } else {
        syncSlide();
        const direction = Math.sign(event.deltaY);
        const current = targetSlideRef.current ?? selectedSlideRef.current;
        let next = current + direction;
        if (next < 0 && window.scrollY > start + 1) {
          next = 0;
        } else if (next >= slides.length && window.scrollY < end - 1) {
          next = slides.length - 1;
        }
        if (next < 0 || next >= slides.length) {
          cancelMotion();
          return;
        }
        event.preventDefault();
        goToSlide(next);
      }
      wheelTimer = window.setTimeout(() => {
        wheelTimer = undefined;
      }, 220);
    }

    function onScroll() {
      syncSlide();
      if (targetSlideRef.current !== null) {
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(clearTarget, 220);
      }
    }

    syncSlide();
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', clearTarget);
    window.addEventListener('keydown', cancelMotion, true);
    window.addEventListener('pointerdown', cancelMotion, true);
    window.addEventListener('touchstart', cancelMotion, { capture: true, passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', clearTarget);
      window.removeEventListener('keydown', cancelMotion, true);
      window.removeEventListener('pointerdown', cancelMotion, true);
      window.removeEventListener('touchstart', cancelMotion, true);
      window.clearTimeout(wheelTimer);
      window.clearTimeout(scrollTimer);
      if (targetSlideRef.current !== null) {
        window.scrollTo({ top: window.scrollY, behavior: 'instant' });
      }
      targetSlideRef.current = null;
    };
  }, [focusedSlide, goToSlide, pinned, slides.length, updateSelectedSlide]);

  return (
    <div
      ref={scene}
      className="scroll-hero"
      data-scroll-scene
      data-pinned={pinned}
      style={
        {
          '--scroll-hero-travel': `${Math.max(0, slides.length - 1) * 50}svh`,
        } as CSSProperties
      }
    >
      <section ref={stage} className="hero scroll-hero-stage">
        <div data-parallax="copy">{children}</div>
        <motion.div
          data-parallax="visual"
          className="scroll-hero-visual"
          role="group"
          aria-roledescription="carousel"
          aria-label="Featured projects"
          aria-describedby={hydrated && slides.length > 1 ? keyboardHintId : undefined}
          tabIndex={hydrated && slides.length > 1 ? 0 : undefined}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }
            const target =
              event.key === 'ArrowRight'
                ? activeSlide + 1
                : event.key === 'ArrowLeft'
                  ? activeSlide - 1
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? slides.length - 1
                      : null;
            if (target !== null) {
              event.preventDefault();
              goToSlide(target);
            }
          }}
          style={{ y: pinned && focusedSlide === null ? parallaxOffset : 0 }}
        >
          <p id={keyboardHintId} className="sr-only" hidden={!hydrated || slides.length < 2}>
            Use the left and right arrow keys to browse featured projects.
          </p>
          <div
            ref={slideStack}
            className="scroll-hero-visual-stack"
            onScroll={(event) => {
              if (!pinned && event.currentTarget.clientWidth) {
                updateSelectedSlide(
                  Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth),
                );
              }
            }}
          >
            {slides.length === 0 && <p>Featured projects will appear here.</p>}
            {slides.map((slide, index) => (
              <motion.div
                key={slide.id}
                className="scroll-hero-slide"
                data-hero-slide={index}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${slides.length}`}
                aria-hidden={pinned && activeSlide !== index}
                inert={pinned && activeSlide !== index}
                onFocusCapture={() => setFocusedSlide(index)}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setFocusedSlide(null);
                  }
                }}
                initial={false}
                animate={{
                  opacity: !pinned || activeSlide === index ? 1 : 0,
                  y: !pinned || activeSlide === index ? 0 : index < activeSlide ? -12 : 12,
                }}
                transition={{ duration: enabled ? 0.45 : 0 }}
                style={{ pointerEvents: !pinned || activeSlide === index ? 'auto' : 'none' }}
              >
                {slide.content}
              </motion.div>
            ))}
          </div>
          {hydrated && slides.length > 1 && (
            <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              Project {activeSlide + 1} of {slides.length}
            </span>
          )}
        </motion.div>
      </section>
    </div>
  );
}
