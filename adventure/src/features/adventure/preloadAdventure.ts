import npcs from '@/content/npcs.json';
import portfolio from '@/content/portfolio.json';
import props from '@/content/props.json';
import moments from '@/content/moments.json';
import residents from '@/content/residents.json';
import terrain from '../../../art/town-redesign/runtime/terrain.json';

/** Warm town and dialogue assets after giving the entry artwork first priority. */
export function preloadAdventure() {
  const hero = document.querySelector<HTMLImageElement>('.entry-art img');
  const controller = new AbortController();
  const images: HTMLImageElement[] = [];
  let started = false, cancelled = false;
  let secondaryTimer = 0;

  const warmImages = (urls: string[], decode = false) => {
    for (const url of new Set(urls)) {
      const image = new Image();
      // The visible welcome artwork and characters always win network priority.
      image.fetchPriority = 'low';
      images.push(image);
      const release = () => {
        image.onload = null;
        image.onerror = null;
        const index = images.indexOf(image);
        if (index !== -1) images.splice(index, 1);
      };
      image.onload = () => {
        if (decode) void image.decode().catch(() => {});
        release();
      };
      image.onerror = release;
      image.src = url;
    }
  };
  const start = () => {
    if (started || cancelled) return;
    started = true;
    window.clearTimeout(fallbackTimer);
    hero?.removeEventListener('load', start);
    hero?.removeEventListener('error', start);
    void import('./createGame').catch(() => { /* The normal game loader retries. */ });
    warmImages([
      ...terrain.tilesets.map(tileset => tileset.path),
      '/game/sheets/male.png', '/game/sheets/female.png',
      ...npcs.map(npc => `/game/sheets/${npc.sprite}-display.png`),
      ...residents.map(resident => `/game/residents/${resident.texture}.png`),
      ...Object.values(props).map(prop => prop.url),
    ]);
    void fetch('/game/maps/town.json', { signal: controller.signal, priority: 'low' }).catch(() => { /* Phaser retries if necessary. */ });
    // Portraits and project covers are ready by the time a visitor starts a dialogue.
    secondaryTimer = window.setTimeout(() => { void import('./ArcadeGame').catch(() => {}); warmImages([
      ...npcs.map(npc => `/game/npcs/${npc.sprite}/idle-0.png`),
      ...portfolio.projects.map(project => project.cover),
      ...(moments.photos as { image: string }[]).slice(0, 6).map(photo => photo.image),
      ...['up', 'mid', 'down', 'dazed'].map(pose => `/game/arcade/bird-animation/${pose}.png`),
    ], true); }, 300);
  };
  // Do not wait indefinitely if the hero image is slow or unavailable.
  const fallbackTimer = window.setTimeout(start, 1500);
  if (!hero || hero.complete) start();
  else { hero.addEventListener('load', start, { once: true }); hero.addEventListener('error', start, { once: true }); }

  return () => {
    cancelled = true;
    window.clearTimeout(fallbackTimer);
    window.clearTimeout(secondaryTimer);
    hero?.removeEventListener('load', start);
    hero?.removeEventListener('error', start);
    controller.abort();
    for (const image of images) {
      image.onload = null;
      image.onerror = null;
    }
    images.length = 0;
  };
}
