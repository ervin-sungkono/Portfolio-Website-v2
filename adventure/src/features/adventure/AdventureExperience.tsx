'use client';

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import portfolio from '@/content/portfolio.json';
import npcs from '@/content/npcs.json';
import world from '@/content/world.json';
import GameCanvas from './GameCanvas';
import Minimap from './Minimap';
import MomentsGallery from './MomentsGallery';
import CafeConversation from './CafeConversation';
import MarketMatch from './MarketMatch';
import { StampTrailButton, StampTrailPanel } from './StampTrail';
import { useStampTrail } from './useStampTrail';
import NpcConversation from './NpcConversation';
import { createAmbientAudio, type AmbientAudio } from './ambientAudio';
import { ACHIEVEMENTS, unlockedIds } from './achievementModel.mjs';
import { useAchievements } from './useAchievements';
import { clearInput, type Character, type GameBridge, type Interaction } from './types';
import { thumbstickVector } from './movementModel.mjs';
import { preloadAdventure } from './preloadAdventure';
import './onboarding.css';

const ArcadeGame = lazy(() => import('./ArcadeGame'));

function Thumbstick({ bridge, disabled }: { bridge: GameBridge; disabled: boolean }) {
  const pad = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const activePointer = useRef<number | null>(null);
  function placeKnob(x: number, y: number) {
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  }
  const reset = useCallback(() => {
    const pointerId = activePointer.current;
    activePointer.current = null;
    if (pointerId !== null && pad.current?.hasPointerCapture(pointerId)) pad.current.releasePointerCapture(pointerId);
    bridge.x = bridge.y = 0;
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)';
  }, [bridge]);
  useEffect(() => {
    const onHidden = () => { if (document.hidden) reset(); };
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', onHidden);
    return () => { window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', onHidden); reset(); };
  }, [reset]);
  useEffect(() => { if (disabled) reset(); }, [disabled, reset]);
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || activePointer.current !== event.pointerId || !pad.current?.hasPointerCapture(event.pointerId)) return;
    const rect = pad.current.getBoundingClientRect();
    const radius = rect.width * 0.33;
    const input = thumbstickVector(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2, radius);
    bridge.x = input.x;
    bridge.y = input.y;
    placeKnob(input.knobX, input.knobY);
  }
  function stop(event: React.PointerEvent<HTMLDivElement>) {
    if (activePointer.current === event.pointerId) reset();
  }
  return <div ref={pad} className="thumbstick" aria-label="Movement joystick" onPointerDown={event => { if (disabled || activePointer.current !== null) return; activePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}><span ref={knob} /></div>;
}

function useDialogFocus() {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    // A focused choice can disappear after dialogue or game state changes.
    const observer = new MutationObserver(() => {
      if (document.hasFocus() && document.activeElement === document.body) dialog.current?.focus({ preventScroll: true });
    });
    if (dialog.current) observer.observe(dialog.current, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (before?.isConnected) before.focus();
      requestAnimationFrame(() => {
        if (document.activeElement === document.body && !document.querySelector('[role="dialog"]')) document.getElementById('adventure-world')?.focus({ preventScroll: true });
      });
    };
  }, []);
  function trap(event: React.KeyboardEvent) {
    if (event.key !== 'Tab' || !dialog.current) return;
    const items = Array.from(dialog.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')).filter(item => item.getClientRects().length > 0);
    if (!items.length) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === dialog.current)) { event.preventDefault(); items.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }
  return { dialog, trap };
}

function MomentsPanel({ close, initialIndex }: { close: () => void; initialIndex: number | null }) {
  const { dialog, trap } = useDialogFocus();
  return <MomentsGallery close={close} dialog={dialog} trap={trap} initialIndex={initialIndex} />;
}

function TrailPanel({ trail, close, startAt }: { trail: ReturnType<typeof useStampTrail>; close: () => void; startAt?: string }) {
  const { dialog, trap } = useDialogFocus();
  return <StampTrailPanel trail={trail} close={close} dialog={dialog} trap={trap} startAt={startAt} />;
}

function Information({ target, close, openTrail }: { target: Interaction; close: () => void; openTrail: () => void }) {
  const { dialog, trap } = useDialogFocus();
  const project = target.kind === 'project' ? portfolio.projects.find(item => item.id === target.id) : undefined;
  const npc = target.kind === 'npc' ? npcs.find(item => item.id === target.id) : undefined;
  const portrait = project || target.kind === 'collection' ? '/game/drafts/prop-terminal.png' : target.kind === 'contact' ? '/game/decor/mailbox.png' : target.kind === 'cafe' ? '/game/decor/city-cafe.webp' : npc ? `/game/npcs/${npc.sprite}/idle-0.png` : '/game/drafts/male-down.png';
  const banner = project || target.kind === 'collection' ? 'MY CREATIONS' : target.kind === 'cafe' ? 'THE CAFÉ CORNER' : target.kind === 'contact' ? 'SAY HELLO' : npc?.banner ?? 'SAY HELLO';
  return <div className="modal-scrim" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="info-panel pixel-dialog" role="dialog" aria-modal="true" aria-labelledby="panel-title" tabIndex={-1} ref={dialog} onKeyDown={trap}>
      <div className="panel-top pixel-banner"><div className="panel-avatar" aria-hidden="true"><img src={portrait} alt="" /></div><div className="panel-banner-copy"><span className="pixel-kicker">✦ &nbsp; THE LITTLE TOWN</span><strong>{banner}</strong></div><button className="icon-button pixel-close" onClick={close} aria-label="Close panel">×</button></div>
      <div className="panel-content">
      {target.kind === 'collection' ? <>
        <h2 id="panel-title">Things I’ve made</h2>
        <p className="lead">A few little creations from my corner of the internet.</p>
        <div className="creation-list">{portfolio.projects.map(item => <article className="creation-card" key={item.id}>
          <img src={item.cover} alt="" /><div><h3>{item.title}</h3><p>{item.summary}</p>
          {item.id === 'wetrack-app' && <p className="creation-credit">Made with Christopher Vinantius and Kenneth Nathanael.</p>}
          <a href={item.links.demo} target="_blank" rel="noreferrer">Take a look ↗</a> <a href={item.links.source} target="_blank" rel="noreferrer">See the code ↗</a></div>
        </article>)}</div>
      </> : project ? <>
        <h2 id="panel-title">{project.title}</h2>
        <p className="lead">{project.summary}</p>
        <img className="project-cover" src={project.cover} alt={`${project.title} project preview`} />
        <div className="tags">{project.technologies.map(tech => <span key={tech}>{tech}</span>)}</div>
        <h3>A little backstory</h3><p>{project.study.context}</p>
        <h3>What’s inside</h3><ul>{project.study.highlights.map(item => <li key={item}>{item}</li>)}</ul>
        <div className="panel-actions"><a className="button primary" href={project.links.demo} target="_blank" rel="noreferrer">Take a look ↗</a><a className="button secondary" href={project.links.source} target="_blank" rel="noreferrer">See how it’s made ↗</a></div>
      </> : npc ? <>
        <h2 id="panel-title">{npc.title}</h2>
        <NpcConversation key={npc.id} npcId={npc.id} />
        {npc.id === 'background-guide' && <button className="button secondary return-button" onClick={openTrail}>✦ &nbsp; Milo’s stamp trail</button>}
      </> : target.kind === 'cafe' ? <>
        <h2 id="panel-title">The café corner</h2>
        <CafeConversation />
      </> : <>
        <h2 id="panel-title">Let’s stay in touch!</h2><p className="lead">Thanks for stopping by my little corner of the internet. Come say hello!</p>
        <div className="contact-links"><a href={portfolio.profile.instagram} target="_blank" rel="noreferrer">Instagram <span>↗</span></a><a href={portfolio.profile.github} target="_blank" rel="noreferrer">GitHub <span>↗</span></a><a href={portfolio.profile.dribbble} target="_blank" rel="noreferrer">Dribbble <span>↗</span></a><a href={portfolio.profile.linkedin} target="_blank" rel="noreferrer">LinkedIn <span>↗</span></a></div>
      </>}
      <button className="button secondary return-button" onClick={close}>← Back to exploring</button>
      </div>
    </div>
  </div>;
}

function Tutorial({ character, skip, begin }: { character: Character; skip: () => void; begin: () => void }) {
  const { dialog, trap } = useDialogFocus();
  const [step, setStep] = useState(0);
  return <div className="modal-scrim tutorial-scrim"><div className="info-panel pixel-dialog tutorial-panel" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-copy" tabIndex={-1} ref={dialog} onKeyDown={trap}>
    <div className="panel-top pixel-banner"><div className="panel-avatar" aria-hidden="true"><img src={`/game/drafts/${character}-down.png`} alt="" /></div><div className="panel-banner-copy"><span className="pixel-kicker">✦ &nbsp; YOUR FIRST STEPS</span><strong>WELCOME, EXPLORER</strong></div><button className="icon-button pixel-close" onClick={skip} aria-label="Skip tutorial">×</button></div>
    <div className="panel-content tutorial-content">
      <div className="tutorial-progress" aria-label={`Tutorial step ${step + 1} of 2`}><span>YOUR ADVENTURE</span><span>{step + 1} / 2</span></div>
      {step === 0 ? <><h2 id="tutorial-title">Let’s take a walk</h2><div id="tutorial-copy"><p className="lead keyboard-help">Use <strong>WASD</strong> or the <strong>arrow keys</strong> to guide your explorer around town.</p><p className="lead touch-help">Move your thumb on the <strong>joystick</strong> to guide your explorer around town.</p></div><div className="tutorial-example keyboard-help" aria-hidden="true"><span>↑</span><span>←</span><span>↓</span><span>→</span><b>WANDER ANYWHERE</b></div><div className="tutorial-example touch-help" aria-hidden="true"><span>✥</span><b>MOVE WITH THE JOYSTICK</b></div></> : <><h2 id="tutorial-title">Say hello & explore</h2><div id="tutorial-copy"><p className="lead keyboard-help">Walk up to a person or object. When a prompt appears, press <strong>E</strong> or <strong>Enter</strong> to interact.</p><p className="lead touch-help">Walk up to a person or object. When a prompt appears, tap <strong>Interact</strong> to say hello or discover what’s there.</p></div><div className="tutorial-destination"><span>✦</span><p>Meet Milo and Ivy, visit the arcade southwest of the fountain, or explore the photo garden to the east.</p></div></>}
      <div className="tutorial-actions"><button className="tutorial-skip" onClick={skip}>Skip tutorial</button><div>{step > 0 && <button className="button secondary" onClick={() => setStep(0)}>Back</button>}<button className="button primary" onClick={() => step === 0 ? setStep(1) : begin()}>{step === 0 ? 'Next →' : 'Try it out →'}</button></div></div>
      <p className="tutorial-replay">Need a reminder later? Open the <strong>?</strong> menu.</p>
    </div>
  </div></div>;
}

function Help({ close, openInteraction, replayTutorial, openTrail }: { close: () => void; openInteraction: (item: Interaction) => void; replayTutorial: () => void; openTrail: () => void }) {
  const { dialog, trap } = useDialogFocus();
  return <div className="modal-scrim"><div ref={dialog} onKeyDown={trap} tabIndex={-1} className="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="icon-button" onClick={close} aria-label="Close help">×</button><span className="eyebrow">TAKE YOUR TIME</span><h2 id="help-title">How to explore</h2><p className="keyboard-help">Use <strong>WASD</strong> or the <strong>arrow keys</strong> to wander. Walk up to someone or something and press <strong>E</strong> or <strong>Enter</strong>. Use <strong>Tab</strong> to reach the menu and <strong>G</strong> to return to the town.</p><p className="touch-help">Use the joystick to wander. Walk up to someone or something and tap <strong>Interact</strong>.</p><p>You can close a panel or leave the town whenever you like.</p><details className="accessible-places"><summary>Open places without moving</summary><p>Choose a place to open its interaction.</p><div>{(world.interactions as Interaction[]).map(item => <button key={item.id} onClick={() => openInteraction(item)}>{item.label} →</button>)}</div></details><div className="help-actions"><button className="button primary" onClick={close}>Let’s explore →</button><button className="button secondary" onClick={replayTutorial}>Replay tutorial</button><button className="button secondary" onClick={openTrail}>✦ Stamp trail</button></div></div></div>;
}

function ArcadePanel({ close, onScore }: { close: () => void; onScore: (score: number) => void }) {
  const { dialog, trap } = useDialogFocus();
  return <div className="modal-scrim" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialog} onKeyDown={trap} tabIndex={-1} className="info-panel pixel-dialog arcade-panel" role="dialog" aria-modal="true" aria-labelledby="arcade-title">
      <div className="panel-top pixel-banner"><div className="panel-avatar" aria-hidden="true"><img src="/game/decor/arcade.png" alt="" /></div><div className="panel-banner-copy"><span className="pixel-kicker">✦ &nbsp; THE LITTLE ARCADE</span><strong id="arcade-title">GARDEN GLIDE</strong></div><button className="icon-button pixel-close" onClick={close} aria-label="Close arcade">×</button></div>
      <Suspense fallback={<p className="arcade-loading">Getting the arcade ready…</p>}><ArcadeGame onScore={onScore} /></Suspense>
    </div>
  </div>;
}

function MatchPanel({ close }: { close: () => void }) {
  const { dialog, trap } = useDialogFocus();
  return <div className="modal-scrim" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialog} onKeyDown={trap} tabIndex={-1} className="info-panel pixel-dialog arcade-panel" role="dialog" aria-modal="true" aria-labelledby="match-title">
      <div className="panel-top pixel-banner"><div className="panel-avatar" aria-hidden="true"><img src="/game/decor/arcade.png" alt="" /></div><div className="panel-banner-copy"><span className="pixel-kicker">✦ &nbsp; THE LITTLE ARCADE</span><strong id="match-title">MARKET MATCH</strong></div><button className="icon-button pixel-close" onClick={close} aria-label="Close Market Match">×</button></div>
      <MarketMatch />
    </div>
  </div>;
}

function AchievementPanel({ progress, close }: { progress: ReturnType<typeof useAchievements>['progress']; close: () => void }) {
  const { dialog, trap } = useDialogFocus();
  const unlocked = unlockedIds(progress);
  return <div className="modal-scrim achievement-scrim" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialog} onKeyDown={trap} tabIndex={-1} className="info-panel pixel-dialog achievements-panel" role="dialog" aria-modal="true" aria-labelledby="achievements-title">
      <div className="panel-top pixel-banner"><div className="achievement-medal" aria-hidden="true">✦</div><div className="panel-banner-copy"><span className="pixel-kicker">✦ &nbsp; YOUR LITTLE ADVENTURE</span><strong id="achievements-title">ACHIEVEMENTS</strong></div><button className="icon-button pixel-close" onClick={close} aria-label="Close achievements">×</button></div>
      <div className="panel-content"><h2>Your discoveries</h2><p className="lead">{unlocked.length} of {ACHIEVEMENTS.length} collected. Progress stays on this device.</p>
        <ol className="achievement-list">{ACHIEVEMENTS.map(item => {
          const value = item.metric === 'bestScore' ? progress.bestScore : progress.visibleMs;
          const achieved = unlocked.includes(item.id);
          const seconds = Math.floor(Math.min(value, item.goal) / 1000);
          const label = item.metric === 'visibleMs' ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} / 5:00` : `${Math.min(value, item.goal)} / ${item.goal}`;
          return <li key={item.id} className={achieved ? 'achievement-earned' : ''}><span className="achievement-icon" aria-hidden="true">{achieved ? '✦' : '◇'}</span><div><strong>{item.title}</strong><p>{item.description}</p><progress aria-label={`${item.title} progress`} value={Math.min(value, item.goal)} max={item.goal} /><small>{achieved ? 'Unlocked!' : label}</small></div></li>;
        })}</ol>
        <p className="achievement-note">Visit time counts while this page is visible, across visits.</p><button className="button secondary" onClick={close}>← Back</button>
      </div>
    </div>
  </div>;
}

export default function AdventureExperience() {
  const [character, setCharacter] = useState<Character>('male');
  const [sound, setSound] = useState(false);
  const [phase, setPhase] = useState<'entry' | 'loading' | 'playing' | 'error'>('entry');
  const [gameMounted, setGameMounted] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [target, setTarget] = useState<Interaction | null>(null);
  const [panel, setPanel] = useState<Interaction | null>(null);
  const [help, setHelp] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [momentsOpen, setMomentsOpen] = useState(false);
  const [momentsIndex, setMomentsIndex] = useState<number | null>(null);
  const [trailOpen, setTrailOpen] = useState(false);
  const [trailStartAt, setTrailStartAt] = useState<string | undefined>();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [guided, setGuided] = useState(false);
  const { progress, notice, recordScore } = useAchievements();
  const trail = useStampTrail();
  const bridge = useRef<GameBridge>({ x: 0, y: 0, interact: false, suspended: false }).current;
  const phaseRef = useRef(phase);
  const gameFailed = useRef(false);
  const tutorialSeen = useRef(false);
  const audio = useRef<AmbientAudio | null>(null);

  const stopAudio = useCallback(() => {
    const current = audio.current;
    audio.current = null;
    current?.dispose();
  }, []);
  const startAudio = useCallback(() => {
    audio.current ??= createAmbientAudio();
    audio.current.start();
  }, []);

  useEffect(() => {
    try { setSound(localStorage.getItem('adventure-sound') === 'on'); } catch { /* storage is optional */ }
    try { tutorialSeen.current = localStorage.getItem('adventure-tutorial-seen') === 'yes'; } catch { /* tutorial still works without storage */ }
    return () => stopAudio();
  }, [stopAudio]);
  useEffect(() => preloadAdventure(), []);
  useEffect(() => {
    const update = () => {
      bridge.suspended = phase !== 'playing' || document.hidden || !!panel || help || achievementsOpen || tutorialOpen || momentsOpen || trailOpen;
      if (bridge.suspended) clearInput(bridge);
      if (document.hidden) audio.current?.suspend();
      else if (sound) audio.current?.resume();
    };
    const onBlur = () => clearInput(bridge);
    update(); document.addEventListener('visibilitychange', update);
    window.addEventListener('blur', onBlur);
    return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('blur', onBlur); };
  }, [bridge, panel, help, sound, achievementsOpen, tutorialOpen, momentsOpen, trailOpen, phase]);
  const finishTutorial = useCallback(() => {
    tutorialSeen.current = true;
    try { localStorage.setItem('adventure-tutorial-seen', 'yes'); } catch { /* storage is optional */ }
    setTutorialOpen(false);
    setGuided(false);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (momentsOpen) setMomentsOpen(false); else if (trailOpen) setTrailOpen(false); else if (tutorialOpen) finishTutorial(); else if (achievementsOpen) setAchievementsOpen(false); else if (panel) setPanel(null); else if (phase === 'playing') setHelp(value => !value); }
      if (event.key.toLowerCase() === 'g' && !event.repeat && phase === 'playing' && !panel && !help && !achievementsOpen && !tutorialOpen && !momentsOpen && !trailOpen && !(event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) {
        event.preventDefault();
        document.getElementById('adventure-world')?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [achievementsOpen, panel, phase, help, tutorialOpen, momentsOpen, trailOpen, finishTutorial]);

  const changePhase = (next: typeof phase) => { phaseRef.current = next; setPhase(next); };
  const exit = () => { clearInput(bridge); bridge.suspended = true; setPanel(null); setHelp(false); setAchievementsOpen(false); setMomentsOpen(false); setTrailOpen(false); setTutorialOpen(false); setGuided(false); stopAudio(); changePhase('entry'); };
  const selectSound = (next: boolean) => {
    setSound(next);
    try { localStorage.setItem('adventure-sound', next ? 'on' : 'off'); } catch { /* storage is optional */ }
    if (phase !== 'entry') { if (next) startAudio(); else stopAudio(); }
  };
  const enter = () => {
    clearInput(bridge);
    if (sound) startAudio();
    if (!gameMounted) gameFailed.current = false;
    setGameMounted(true);
    if (gameReady) { changePhase('playing'); if (!tutorialSeen.current) setTutorialOpen(true); }
    else changePhase('loading');
  };
  const openMoments = (index: number | null = null) => { clearInput(bridge); setMomentsIndex(index); setMomentsOpen(true); };
  const openTrail = (fromMilo = false) => { clearInput(bridge); setPanel(null); setHelp(false); setTrailStartAt(fromMilo ? 'background-guide' : undefined); trail.clearCompletion(); setTrailOpen(true); };
  const interact = useCallback((item: Interaction) => {
    if (guided && item.id === 'background-guide') finishTutorial();
    trail.visit(item.id);
    clearInput(bridge);
    if (item.kind === 'moments') { setMomentsIndex(item.photoIndex ?? null); setMomentsOpen(true); }
    else setPanel(item);
  }, [bridge, guided, finishTutorial, trail.visit]);
  const focusWorld = () => requestAnimationFrame(() => document.getElementById('adventure-world')?.focus({ preventScroll: true }));
  const unlockedCount = unlockedIds(progress).length;
  const announcement = notice && <div className="achievement-toast" role="status"><span aria-hidden="true">✦</span><div><small>ACHIEVEMENT UNLOCKED</small><strong>{notice}</strong></div></div>;

  const entryScreen = <main className="entry-screen">
    <picture className="entry-art" aria-hidden="true"><source type="image/webp" srcSet="/game/town-proof-lossless.webp" /><img src="/game/town-proof.png" alt="" fetchPriority="high" /></picture>
    <div className="entry-wash" />
    <section className="entry-content">
      <div className="brand"><span className="brand-star">✦</span><span>ERVIN’S LITTLE WORLD</span></div>
      <div className="entry-card">
        <span className="eyebrow">A LITTLE WORLD TO EXPLORE</span>
        <h1>A little world<br /><em>worth exploring.</em></h1>
        <p className="entry-description">Come say hello, meet a few friendly faces, and discover a little more about me along the way.</p>
        <div className="divider" />
        <div className="choice-heading"><div><span className="choice-number">01</span><strong>Meet your explorer</strong></div><span>Choose a companion</span></div>
        <div className="characters" role="group" aria-label="Choose your explorer">
          {(['male', 'female'] as const).map((item, index) => <button key={item} className={`character-card ${character === item ? 'selected' : ''}`} aria-pressed={character === item} onClick={() => setCharacter(item)}><img src={`/game/drafts/${item}-down.png`} alt="" /><span><small>EXPLORER 0{index + 1}</small><strong>{item === 'male' ? 'Boy' : 'Girl'}</strong><em>{character === item ? 'Ready to explore' : 'Choose me'}</em></span><i aria-hidden="true">{character === item ? '✓' : '+'}</i></button>)}
        </div>
        <div className="choice-heading sound-heading"><div><span className="choice-number">02</span><strong>Set the mood</strong></div><div className="sound-choice"><button aria-pressed={!sound} className={!sound ? 'active' : ''} onClick={() => selectSound(false)}>Off</button><button aria-pressed={sound} className={sound ? 'active' : ''} onClick={() => selectSound(true)}>On ♫</button></div></div>
        <button className="enter-button" onClick={enter}>Enter the town</button>
        <div className="entry-footer"><span>✳ &nbsp; A 3–5 minute adventure</span><span>MADE WITH CURIOSITY</span></div>
        <div className="entry-shortcuts"><button className="entry-achievements" onClick={() => openMoments()}>▧ &nbsp; Moments</button><button className="entry-achievements" onClick={() => setAchievementsOpen(true)}>✦ &nbsp; Achievements <span>{unlockedCount}/{ACHIEVEMENTS.length}</span></button></div>
      </div>
      <p className="entry-copyright">DESIGNED & BUILT BY ERVIN CAHYADINATA SUNGKONO <span>✦</span></p>
    </section>
    <noscript><section className="noscript"><h2>Ervin’s little world</h2><p>Welcome to my little corner of the internet.</p>{portfolio.projects.map(project => <p key={project.id}><a href={project.links.source}>{project.title}</a> — {project.summary}</p>)}<a href={portfolio.profile.instagram}>Say hello on Instagram</a></section></noscript>
    {achievementsOpen && <AchievementPanel progress={progress} close={() => setAchievementsOpen(false)} />}{announcement}
  </main>;

  const errorScreen = <main className="fallback"><span className="eyebrow">THE TOWN IS RESTING</span><h1>Let’s try another way.</h1><p>The world couldn’t load, but you can still see a few things Ervin has made.</p><div className="fallback-list">{portfolio.projects.map(project => <p key={project.id}><a href={project.links.source}>{project.title} ↗</a><br />{project.summary}</p>)}</div><p><a href={portfolio.profile.instagram}>Say hello on Instagram ↗</a></p><button className="button primary" onClick={exit}>Return to start</button></main>;

  const gameVisible = phase === 'loading' || phase === 'playing';
  return <>
    {phase === 'entry' && entryScreen}
    {phase === 'error' && errorScreen}
    {gameMounted && <main className="play-screen" style={{ visibility: gameVisible ? 'visible' : 'hidden' }} aria-hidden={!gameVisible} inert={!gameVisible} onPointerDown={() => { if (sound) startAudio(); }} onKeyDown={() => { if (sound) startAudio(); }}>
    <GameCanvas character={character} bridge={bridge} active={gameVisible} overlayOpen={!!panel || help || achievementsOpen || tutorialOpen || momentsOpen || trailOpen} onReady={() => { if (gameFailed.current) return; setGameReady(true); if (phaseRef.current === 'loading') { changePhase('playing'); if (!tutorialSeen.current) setTutorialOpen(true); } }} onTarget={setTarget} onInteract={interact} onError={() => { gameFailed.current = true; setGameMounted(false); setGameReady(false); setTarget(null); stopAudio(); if (phaseRef.current !== 'entry') changePhase('error'); }} />
    {phase === 'loading' && <div className="loading"><div className="loading-star">✦</div><strong>Opening the little world...</strong><button onClick={exit}>Cancel</button></div>}
    <div className="hud-top"><div className="location"><span>✦</span><div><strong>THE LITTLE TOWN</strong><small>Explore at your own pace</small></div></div><div className="hud-actions"><button className="moments-trigger" onClick={() => openMoments()} aria-label="Open Moments photo gallery" title="Moments"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-3 5 5" /></svg><span className="moments-trigger-label">Moments</span></button><button onClick={() => setAchievementsOpen(true)} aria-label={`Achievements: ${unlockedCount} of ${ACHIEVEMENTS.length} unlocked`} title="Achievements">✦</button><button onClick={() => setHelp(true)} aria-label="Controls and help">?</button><button onClick={() => selectSound(!sound)} aria-label={sound ? 'Mute sound' : 'Turn sound on'} aria-pressed={sound}>{sound ? '♫' : '♪̸'}</button><button className="exit-button" onClick={exit}>Exit</button></div></div>
    {phase === 'playing' && <Minimap bridge={bridge} guiding={guided && !tutorialOpen && !panel && !help && !achievementsOpen && !momentsOpen && !trailOpen} />}
    <div className="sr-only" aria-live="polite">{target ? `Nearby: ${target.label}.` : ''}</div>
    {target && !panel && !help && !achievementsOpen && !tutorialOpen && !momentsOpen && !trailOpen && <div className="interaction-prompt"><span className="interaction-key">E</span><span className="interaction-touch">Tap Interact · </span>{target.label}</div>}
    <div className="desktop-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move <span>·</span> <kbd>E</kbd> interact <span>·</span> <kbd>G</kbd> resume walking</div>
    <div className="touch-controls"><Thumbstick bridge={bridge} disabled={phase !== 'playing' || !!panel || help || achievementsOpen || tutorialOpen || momentsOpen || trailOpen} /><button className="touch-interact" disabled={!target || phase !== 'playing' || !!panel || help || achievementsOpen || tutorialOpen || momentsOpen || trailOpen} onClick={() => { bridge.interact = true; }} aria-label={target ? 'Interact' : 'Move closer to interact'}>✦<small>{target ? 'INTERACT' : 'MOVE CLOSER'}</small></button></div>
    {panel && (panel.kind === 'arcade'
      ? <ArcadePanel close={() => { clearInput(bridge); setPanel(null); }} onScore={recordScore} />
      : panel.kind === 'match'
        ? <MatchPanel close={() => { clearInput(bridge); setPanel(null); }} />
        : <Information target={panel} close={() => { clearInput(bridge); setPanel(null); }} openTrail={() => openTrail(true)} />)}
    {help && <Help close={() => setHelp(false)} openInteraction={item => { setHelp(false); interact(item); }} replayTutorial={() => { setHelp(false); setGuided(false); setTutorialOpen(true); }} openTrail={() => openTrail()} />}
    {tutorialOpen && <Tutorial character={character} skip={() => { finishTutorial(); focusWorld(); }} begin={() => { setTutorialOpen(false); setGuided(true); focusWorld(); }} />}
    {guided && !tutorialOpen && !panel && !help && !achievementsOpen && !momentsOpen && !trailOpen && <div className="guide-prompt"><span aria-hidden="true">✦</span><div role="status"><strong>{target?.id === 'background-guide' ? 'Say hello to Milo!' : 'Find Milo, the Navigator'}</strong><small>{target?.id === 'background-guide' ? <><span className="keyboard-help">Press E or Enter to talk.</span><span className="touch-help">Tap Interact to talk.</span></> : 'Head up and left from the plaza to meet your first neighbor.'}</small></div><button onClick={() => { finishTutorial(); focusWorld(); }}>Skip</button></div>}
    {(trail.progress.active || trail.newCompletion) && !guided && !panel && !help && !achievementsOpen && !momentsOpen && !tutorialOpen && !trailOpen && <div className="stamp-trail-hud"><StampTrailButton trail={trail} open={() => openTrail()} />{trail.newCompletion && <span role="status">Postcard ready!</span>}</div>}
    {trailOpen && <TrailPanel trail={trail} close={() => setTrailOpen(false)} startAt={trailStartAt} />}
    {achievementsOpen && <AchievementPanel progress={progress} close={() => setAchievementsOpen(false)} />}{announcement}
  </main>}
  {momentsOpen && <MomentsPanel close={() => setMomentsOpen(false)} initialIndex={momentsIndex} />}
  </>;
}
