const playButton = document.getElementById('play');
const speed = document.getElementById('speed');
const zoom = document.getElementById('zoom');
const status = document.getElementById('load-status');
const cards = [];
let playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let timer;

function updatePlayButton() {
  playButton.textContent = playing ? 'Pause animations' : 'Play animations';
  playButton.setAttribute('aria-pressed', String(playing));
}

function draw(card) {
  const { spec, image, canvas, frame } = card;
  if (!image.complete || !image.naturalWidth) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const w = spec.width, h = spec.height;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (spec.mode === 'repeat') {
    for (let y = 0; y < canvas.height; y += h) for (let x = 0; x < canvas.width; x += w) {
      context.drawImage(image, frame * w, 0, w, h, x, y, w, h);
    }
  } else {
    context.drawImage(image, frame * w, 0, w, h, 0, 0, w, h);
  }
  card.counter.textContent = `Frame ${frame + 1} of ${spec.frames} · ${w} × ${h}px`;
}

function schedule() {
  window.clearTimeout(timer);
  timer = undefined;
  if (!playing || document.hidden || !cards.some(card => card.visible && card.ready)) return;
  timer = window.setTimeout(() => {
    for (const card of cards) if (card.visible && card.ready) {
      card.frame = (card.frame + 1) % card.spec.frames;
      draw(card);
    }
    schedule();
  }, 1000 / Number(speed.value));
}

playButton.addEventListener('click', () => { playing = !playing; updatePlayButton(); schedule(); });
speed.addEventListener('input', () => {
  document.getElementById('speed-value').value = `${speed.value} frames/s`;
  schedule();
});
zoom.addEventListener('change', () => {
  for (const { canvas } of cards) {
    canvas.style.width = `${canvas.width * Number(zoom.value)}px`;
    canvas.style.height = `${canvas.height * Number(zoom.value)}px`;
  }
});
document.addEventListener('visibilitychange', schedule);
window.addEventListener('pagehide', () => window.clearTimeout(timer));
window.addEventListener('pageshow', schedule);
updatePlayButton();

const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    const card = cards.find(item => item.canvas === entry.target);
    if (card) card.visible = entry.isIntersecting;
  }
  schedule();
}, { rootMargin: '100px' }) : null;

try {
  const response = await fetch('./manifest.json');
  if (!response.ok) throw new Error('The review manifest could not load.');
  const manifest = await response.json();
  let loaded = 0;
  for (const spec of manifest.animations) {
    const article = document.createElement('article'); article.className = 'animation-card';
    const stage = document.createElement('div'); stage.className = 'animation-stage checker';
    const canvas = document.createElement('canvas'); canvas.width = spec.width * (spec.mode === 'repeat' ? 3 : 1); canvas.height = spec.height * (spec.mode === 'repeat' ? 2 : 1);
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${spec.title} animation study`);
    stage.append(canvas);
    const heading = document.createElement('h3'); heading.textContent = spec.title;
    const description = document.createElement('p'); description.textContent = spec.description;
    const foot = document.createElement('div'); foot.className = 'animation-foot';
    const counter = document.createElement('span'); counter.textContent = 'Loading…';
    const step = document.createElement('button'); step.type = 'button'; step.textContent = 'Next frame →'; step.setAttribute('aria-label', `Next frame of ${spec.title}`);
    foot.append(counter, step);
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Inspect the four source frames';
    const strip = document.createElement('div'); strip.className = 'frame-strip';
    const stripImage = document.createElement('img'); stripImage.alt = `Four-frame source strip for ${spec.title}`;
    strip.append(stripImage); details.append(summary, strip); article.append(stage, heading, description, foot, details);
    document.getElementById('animations').append(article);
    const image = stripImage;
    const card = { spec, image, canvas, counter, frame: 0, visible: !observer, ready: false }; cards.push(card);
    step.addEventListener('click', () => { playing = false; updatePlayButton(); card.frame = (card.frame + 1) % spec.frames; draw(card); schedule(); });
    image.onload = () => { card.ready = true; loaded++; draw(card); status.textContent = `${loaded} of ${manifest.animations.length} animation studies ready. ${playing ? 'Loops play only while visible.' : 'Motion is paused.'}`; schedule(); };
    image.onerror = () => { counter.textContent = 'This asset could not load. Refresh to retry.'; status.textContent = 'One or more studies could not load; the static artwork below is still available.'; };
    image.src = `./assets/${spec.file}`;
    observer?.observe(canvas);
  }
} catch {
  status.textContent = 'Animation studies could not load. The static art is still available below; refresh to retry.';
}
