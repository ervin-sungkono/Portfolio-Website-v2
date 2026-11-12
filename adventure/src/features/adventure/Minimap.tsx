'use client';

import { useEffect, useRef, useState } from 'react';
import world from '@/content/world.json';
import type { GameBridge } from './types';
import './minimap.css';

/** A compact overview; the marker reads Phaser's position without re-rendering React. */
export default function Minimap({ bridge, guiding }: { bridge: GameBridge; guiding: boolean }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = world.interactions.find(item => item.id === selectedId);
  const marker = useRef<SVGCircleElement>(null);

  useEffect(() => {
    setOpen(window.matchMedia('(pointer: fine) and (min-width: 700px)').matches);
  }, []);
  useEffect(() => {
    if (!open) return;
    const update = () => {
      marker.current?.setAttribute('cx', String(bridge.playerX ?? world.spawn.x));
      marker.current?.setAttribute('cy', String(bridge.playerY ?? world.spawn.y));
    };
    update();
    const interval = window.setInterval(update, 100);
    return () => window.clearInterval(interval);
  }, [bridge, open]);

  return <div className={`town-minimap${guiding ? ' has-guide' : ''}`}>
    <button type="button" className="minimap-toggle" aria-expanded={open} aria-controls="town-minimap-overview" onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">⌖</span> {open ? 'Hide map' : 'Show map'}
    </button>
    {open && <div id="town-minimap-overview" className="minimap-card">
      <div className="minimap-heading"><strong>THE LITTLE TOWN</strong><span aria-hidden="true">N ↑</span></div>
      <div className="minimap-art" style={{ aspectRatio: `${world.width} / ${world.height}` }} role="img" aria-label={`Town map. The green dot is your position and gold dots are places to explore.${selected ? ` The highlighted ring marks ${selected.displayName}, ${selected.role.toLowerCase()}.` : ''}`}>
        <img src="/game/maps/town-minimap.svg" alt="" draggable={false} />
        <svg viewBox={`0 0 ${world.width} ${world.height}`} aria-hidden="true">
          {selected && <circle cx={selected.x} cy={selected.y} r="80" fill="none" stroke="#173f32" strokeWidth="30" />}
          <circle ref={marker} cx={world.spawn.x} cy={world.spawn.y} r="36" fill="#2c6656" stroke="#fff9e7" strokeWidth="15" />
        </svg>
      </div>
      <div className="minimap-legend" aria-hidden="true"><span><i /> You</span><span><i /> Places</span></div>
      {selected && <p className="minimap-selection" role="status">Ring: {selected.displayName}, {selected.role.toLowerCase()}</p>}
      <details className="minimap-places"><summary>Places</summary><p className="minimap-selection">Choose a place to mark it on the map.</p><ul>{world.interactions.map(item => <li key={item.id}><button type="button" aria-pressed={selectedId === item.id} onClick={() => setSelectedId(current => current === item.id ? null : item.id)}><strong>{item.displayName}</strong> <span>· {item.role.toLowerCase()}</span>{(item.kind === 'arcade' || item.kind === 'match') && <small>Southwest of the fountain</small>}{item.kind === 'moments' && <small>Photo garden, east of the fountain</small>}</button></li>)}</ul><p className="minimap-scroll-hint">Scroll for more places</p></details>
    </div>}
  </div>;
}
