'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useAnimate, useInView, useReducedMotion } from 'motion/react';

// Content remains visible in server HTML and when JavaScript is unavailable.
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const inView = useInView(scope, { once: true, amount: 'some' });
  const reduceMotion = useReducedMotion();
  const playback = useRef<{ complete(): void } | null>(null);

  useEffect(() => {
    if (!inView || reduceMotion !== false) return;
    const animation = animate(
      scope.current,
      { opacity: [0, 1], y: [10, 0] },
      {
        duration: 0.35,
        delay,
        ease: [0.22, 1, 0.36, 1],
      },
    );
    playback.current = animation;
    return () => {
      animation.complete();
    };
  }, [inView, reduceMotion, animate, scope, delay]);

  return (
    <div
      ref={scope}
      className={className}
      data-reveal
      onFocusCapture={() => playback.current?.complete()}
    >
      {children}
    </div>
  );
}
