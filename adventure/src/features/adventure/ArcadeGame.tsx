'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SKY, activateFlight, newFlight, stepFlight } from './arcadeModel.mjs';
import { impactFeedback } from './arcadeImpact.mjs';

type Flight = ReturnType<typeof newFlight>;
type Status = Flight['status'];
type BirdPose = 'up' | 'mid' | 'down' | 'dazed';
type BirdFrames = Partial<Record<BirdPose, HTMLImageElement>>;
type WhiteBirdFrames = Partial<Record<BirdPose, HTMLCanvasElement>>;
const BEST_KEY = 'little-world-garden-glide-best';

function makeWhiteSilhouette(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function drawFlight(canvas: HTMLCanvasElement | null, flight: Flight, birds: BirdFrames, whiteBirds: WhiteBirdFrames, reducedMotion: boolean) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#b9e5df'; ctx.fillRect(0, 0, SKY.width, SKY.height);
  const impact = impactFeedback(flight.status, flight.crashFrames, reducedMotion);
  ctx.save();
  ctx.translate(impact.x, impact.y);
  ctx.fillStyle = '#d7f1df'; ctx.fillRect(0, 222, SKY.width, 80);
  ctx.fillStyle = '#f8dfa1'; ctx.fillRect(253, 29, 26, 26);
  ctx.fillStyle = '#fff3ca'; ctx.fillRect(257, 33, 18, 18);
  // Distant clouds and a stepped treeline give the tiny screen some depth.
  ctx.fillStyle = '#f8f6df';
  for (const [x, y] of [[32, 48], [157, 79], [250, 125]]) {
    ctx.fillRect(x, y, 45, 9); ctx.fillRect(x + 8, y - 7, 25, 8); ctx.fillRect(x + 17, y - 13, 12, 7);
  }
  ctx.fillStyle = '#a1ceae';
  for (let x = -20; x < SKY.width + 30; x += 38) {
    ctx.fillRect(x, 248, 32, 54); ctx.fillRect(x + 5, 234, 22, 20); ctx.fillRect(x + 11, 227, 10, 8);
  }
  ctx.fillStyle = '#7cad85'; ctx.fillRect(0, 292, SKY.width, 62);
  ctx.fillStyle = '#98c193';
  for (let x = 0; x < SKY.width; x += 28) ctx.fillRect(x, 286 + (x % 3) * 3, 18, 9);
  // Flower-topped garden pillars make the openings easy to read.
  for (const gate of flight.gates) {
    const x = Math.round(gate.x), top = Math.round(gate.center - gate.gap / 2), bottom = Math.round(gate.center + gate.gap / 2);
    ctx.fillStyle = '#4b7858'; ctx.fillRect(x, 0, SKY.gateWidth, top); ctx.fillRect(x, bottom, SKY.gateWidth, SKY.ground - bottom);
    ctx.fillStyle = '#76a16b'; ctx.fillRect(x + 4, 0, SKY.gateWidth - 9, top); ctx.fillRect(x + 4, bottom, SKY.gateWidth - 9, SKY.ground - bottom);
    ctx.fillStyle = '#99bb80'; ctx.fillRect(x + 7, 0, 5, top); ctx.fillRect(x + 7, bottom, 5, SKY.ground - bottom);
    ctx.fillStyle = '#3d6750'; ctx.fillRect(x - 3, top - 10, SKY.gateWidth + 6, 10); ctx.fillRect(x - 3, bottom, SKY.gateWidth + 6, 10);
    ctx.fillStyle = '#d4b277'; ctx.fillRect(x, top - 10, SKY.gateWidth, 4); ctx.fillRect(x, bottom, SKY.gateWidth, 4);
    ctx.fillStyle = '#f3cc75'; ctx.fillRect(x + 8, top - 16, 5, 5); ctx.fillRect(x + 28, bottom + 11, 5, 5);
    ctx.fillStyle = '#e99976'; ctx.fillRect(x + 28, top - 19, 6, 6); ctx.fillRect(x + 9, bottom + 13, 6, 6);
  }
  ctx.fillStyle = '#6d9b67'; ctx.fillRect(0, SKY.ground, SKY.width, 8);
  ctx.fillStyle = '#bf9a6c'; ctx.fillRect(0, SKY.ground + 8, SKY.width, SKY.height - SKY.ground - 8);
  ctx.fillStyle = '#e0bd84';
  for (let x = 0; x < SKY.width; x += 24) ctx.fillRect(x, SKY.ground + 14, 13, 3);
  const y = Math.round(flight.birdY);
  const crashed = flight.status === 'crashing' || flight.status === 'over';
  const pose: BirdPose = crashed ? 'dazed' : flight.flapFrames < 5 ? 'down' : flight.flapFrames < 10 ? 'mid' : flight.flapFrames < 16 ? 'up' : flight.velocity > 0 ? (Math.floor(flight.frame / 12) % 2 ? 'mid' : 'down') : 'up';
  const bird = birds[pose] ?? birds.up;
  ctx.save();
  ctx.translate(SKY.birdX, y);
  ctx.rotate(crashed ? (reducedMotion ? 0 : Math.min(1.6, flight.crashFrames * 0.07)) : Math.max(-0.3, Math.min(0.35, flight.velocity * 0.065)));
  const whiteBird = whiteBirds[pose] ?? whiteBirds.up;
  if (impact.flash && whiteBird) {
    ctx.drawImage(whiteBird, -20, -16, 40, 32.5);
  } else if (impact.flash) {
    // Keep a clear impact cue even if sprite images have not finished loading.
    ctx.fillStyle = '#fff'; ctx.fillRect(-13, -9, 25, 18); ctx.fillRect(-10, -11, 20, 18); ctx.fillRect(10, -3, 7, 4);
  } else if (bird?.complete && bird.naturalWidth) {
    ctx.drawImage(bird, -20, -16, 40, 32.5);
  } else {
    // Simple fallback keeps the game usable if its decorative art is unavailable.
    ctx.fillStyle = '#315d63'; ctx.fillRect(-13, -9, 25, 18);
    ctx.fillStyle = '#62b8c0'; ctx.fillRect(-10, -11, 20, 18);
    ctx.fillStyle = '#a4ded3'; ctx.fillRect(-10, -3, 11, 7);
    ctx.fillStyle = '#293e3c'; ctx.fillRect(5, -6, 3, 3);
    ctx.fillStyle = '#f0b35c'; ctx.fillRect(10, -3, 7, 4);
  }
  ctx.restore();
  ctx.restore();
}

export default function ArcadeGame({ onScore }: { onScore: (score: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLButtonElement>(null);
  const birds = useRef<BirdFrames>({});
  const whiteBirds = useRef<WhiteBirdFrames>({});
  const reduceMotion = useRef(false);
  const scoreCallback = useRef(onScore);
  const bestScore = useRef(0);
  const flight = useRef<Flight>(newFlight());
  const [status, setStatus] = useState<Status>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  useEffect(() => { scoreCallback.current = onScore; }, [onScore]);

  const pause = useCallback(() => {
    if (flight.current.status !== 'playing') return;
    flight.current = { ...flight.current, status: 'paused' };
    setStatus('paused');
  }, []);
  const action = useCallback(() => {
    const previous = flight.current.status;
    flight.current = activateFlight(flight.current);
    if (previous === 'over') setScore(0);
    if (previous === 'ready' || previous === 'paused' || previous === 'over') setStatus('playing');
  }, []);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(BEST_KEY));
      if (Number.isSafeInteger(saved) && saved > 0) { bestScore.current = saved; setBest(saved); }
    } catch { /* A high score is optional when storage is unavailable. */ }
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const images = (['up', 'mid', 'down', 'dazed'] as const).map(pose => {
      const image = new Image();
      image.onload = () => {
        birds.current[pose] = image;
        const silhouette = makeWhiteSilhouette(image);
        if (silhouette) whiteBirds.current[pose] = silhouette;
        drawFlight(canvas.current, flight.current, birds.current, whiteBirds.current, reduceMotion.current);
      };
      image.src = `/game/arcade/bird-animation/${pose}.png`;
      return image;
    });
    return () => { images.forEach(image => { image.onload = null; }); };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || event.code !== 'Space') return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('button,a,input,textarea,select,[contenteditable="true"]') && target !== stage.current) return;
      event.preventDefault(); action();
    };
    const onVisibility = () => { if (document.hidden) pause(); };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', onVisibility); };
  }, [action, pause]);

  useEffect(() => {
    drawFlight(canvas.current, flight.current, birds.current, whiteBirds.current, reduceMotion.current);
    if (status !== 'playing' && status !== 'crashing') return;
    let request = 0, last = 0, remainder = 0;
    const frame = (time: number) => {
      if (flight.current.status !== 'playing' && flight.current.status !== 'crashing') return;
      if (!last) last = time;
      remainder += Math.min(time - last, 100); last = time;
      let advanced = false;
      while (remainder >= 1000 / 60 && (flight.current.status === 'playing' || flight.current.status === 'crashing')) {
        const previousStatus = flight.current.status;
        const previousScore = flight.current.score;
        flight.current = stepFlight(flight.current);
        if (reduceMotion.current && flight.current.status === 'crashing') flight.current = { ...flight.current, status: 'over', crashFrames: SKY.crashDuration };
        if (flight.current.score !== previousScore) {
          const value = flight.current.score;
          setScore(value);
          scoreCallback.current(value);
          if (value > bestScore.current) {
            bestScore.current = value; setBest(value);
            try { localStorage.setItem(BEST_KEY, String(value)); } catch { /* storage is optional */ }
          }
        }
        advanced = true;
        remainder -= 1000 / 60;
        // Show the impact frame even if a slow frame needs several simulation steps.
        if (previousStatus === 'playing' && flight.current.status === 'crashing') { remainder = 0; break; }
      }
      if (advanced) drawFlight(canvas.current, flight.current, birds.current, whiteBirds.current, reduceMotion.current);
      if (flight.current.status !== status) setStatus(flight.current.status);
      if (flight.current.status === 'playing' || flight.current.status === 'crashing') request = window.requestAnimationFrame(frame);
    };
    request = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(request);
  }, [status]);

  return <div className="arcade-game">
    <div className="arcade-score" aria-live="polite"><span>GATES <strong>{score}</strong></span><span>BEST <strong>{best}</strong></span></div>
    <button ref={stage} type="button" className="arcade-stage" onClick={action} aria-label={status === 'ready' ? 'Start flying' : status === 'playing' ? 'Flap wings' : status === 'paused' ? 'Resume flying' : status === 'over' ? 'Play again' : 'Flight ending'} aria-describedby="arcade-instructions">
      <canvas ref={canvas} width={SKY.width} height={SKY.height} aria-hidden="true" />
      {status !== 'playing' && status !== 'crashing' && <span className="arcade-overlay"><strong>{status === 'ready' ? 'Ready to fly?' : status === 'paused' ? 'Taking a breather' : 'Nice flight!'}</strong>{status === 'over' && <span>{score} {score === 1 ? 'gate' : 'gates'} cleared</span>}<span className="arcade-keyboard">{status === 'ready' ? 'Click here or press Space to start' : status === 'paused' ? 'Click here or press Space to resume' : 'Click here or press Space to play again'}</span><span className="arcade-touch">{status === 'ready' ? 'Tap here to start' : status === 'paused' ? 'Tap here to resume' : 'Tap here to play again'}</span></span>}
    </button>
    <p id="arcade-instructions" className="arcade-instructions"><span className="arcade-keyboard">Click the game or press Space to flap through the garden gates.</span><span className="arcade-touch">Tap the game to flap through the garden gates.</span></p>
    <div className="arcade-controls">
      {status === 'playing' && <button className="button secondary" onClick={() => { pause(); stage.current?.focus(); }}>Pause</button>}
    </div>
    <p className="sr-only" aria-live="polite">{status === 'over' ? `Flight ended. You cleared ${score} gates.` : status === 'paused' ? 'Game paused.' : ''}</p>
  </div>;
}
