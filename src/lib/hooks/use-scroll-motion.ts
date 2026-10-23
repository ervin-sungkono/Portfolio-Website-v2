'use client';

import { useEffect, useState } from 'react';

// Match the two-column layout and leave short viewports on normal scrolling.
const scrollMotionQuery =
  '(min-width: 64rem) and (min-height: 48rem) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

export function useScrollMotion() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(scrollMotionQuery);
    const sync = () => setEnabled(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return enabled;
}
