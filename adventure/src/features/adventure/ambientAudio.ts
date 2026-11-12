/** Optional town music. Start from a visitor gesture; stop it on mute or exit. */
export type AmbientAudio = {
  start: () => void;
  resume: () => void;
  suspend: () => void;
  dispose: () => void;
};

export function createAmbientAudio(): AmbientAudio {
  let track: HTMLAudioElement | null = null;
  let active = false;
  let disposed = false;

  const resume = () => {
    if (!track || disposed) return;
    active = true;
    const current = track;
    if (!current.paused) return;
    try {
      // A browser may reject autoplay, or resolve play() after mute/exit.
      void current.play()?.then(() => {
        if (!active || disposed || track !== current) current.pause();
      }).catch(() => { /* The next visitor gesture can retry playback. */ });
    } catch { /* Audio is optional. */ }
  };

  const start = () => {
    if (disposed || typeof window === 'undefined' || typeof Audio === 'undefined') return;
    if (!track) {
      try {
        track = new Audio('/game/audio/pixelland-loop.mp3');
        track.loop = true;
        track.volume = 0.35;
        track.preload = 'auto';
      } catch { track = null; return; }
    }
    resume();
  };

  const suspend = () => {
    active = false;
    track?.pause();
  };

  const dispose = () => {
    active = false;
    disposed = true;
    if (!track) return;
    const current = track;
    track = null;
    current.pause();
    current.removeAttribute('src');
    current.load();
  };

  return { start, resume, suspend, dispose };
}
