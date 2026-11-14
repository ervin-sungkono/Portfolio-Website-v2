'use client';

import { steps, useAnimate } from 'motion/react';
import { useEffect } from 'react';
import type { TypewriterProps } from './type';
import './style.css';

export function Typewriter({ text, className, style }: TypewriterProps) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();

  useEffect(() => {
    const element = scope.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || media.matches) {
      return;
    }
    const animation = animate(
      element,
      { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] },
      { duration: 1.5, ease: steps(Math.max(1, text.length)) },
    );
    function finishForReducedMotion() {
      if (media.matches) {
        animation.complete();
        element.style.clipPath = '';
      }
    }
    media.addEventListener('change', finishForReducedMotion);
    return () => {
      media.removeEventListener('change', finishForReducedMotion);
      animation.complete();
      element.style.clipPath = '';
    };
  }, [animate, scope, text]);

  return (
    <span
      ref={scope}
      className={`typewriter ${className ?? ''}`.trim()}
      style={style}
      data-typewriter
    >
      {text}
    </span>
  );
}
