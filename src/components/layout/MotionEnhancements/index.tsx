'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { motion, useScroll } from 'motion/react';
import './style.css';

const DesktopCursor = dynamic(() => import('../DesktopCursor'), { ssr: false });

export function MotionEnhancements() {
  const [desktop, setDesktop] = useState(false);
  const { scrollYProgress } = useScroll();
  useEffect(() => {
    const media = window.matchMedia(
      '(min-width: 64rem) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
    function sync() {
      setDesktop(media.matches);
    }
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return (
    <>
      <motion.div
        aria-hidden="true"
        className="motion-enhancements-progress"
        style={{ scaleX: scrollYProgress }}
      />
      {desktop && <DesktopCursor />}
    </>
  );
}
