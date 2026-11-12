'use client';

import { useEffect, useRef } from 'react';
import type { Character, GameBridge, Interaction } from './types';

type Props = {
  character: Character;
  bridge: GameBridge;
  active?: boolean;
  overlayOpen: boolean;
  onReady: () => void;
  onTarget: (target: Interaction | null) => void;
  onInteract: (target: Interaction) => void;
  onError: () => void;
};

export default function GameCanvas({ character, bridge, active = true, overlayOpen, onReady, onTarget, onInteract, onError }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<{ setActive: (paused: boolean) => void; setCharacter: (character: Character) => void; resetKeyboard: () => void; destroy: () => void } | null>(null);
  const ready = useRef(false);
  const latest = useRef({ character, active, overlayOpen });
  latest.current = { character, active, overlayOpen };
  const previousActive = useRef(active);
  const callbacks = useRef({ onReady, onTarget, onInteract, onError });
  callbacks.current = { onReady, onTarget, onInteract, onError };
  useEffect(() => { controller.current?.setCharacter(character); }, [character]);
  useEffect(() => {
    const resumed = active && !previousActive.current;
    previousActive.current = active;
    if (!ready.current) return;
    controller.current?.setActive(!active || overlayOpen);
    if (resumed && !overlayOpen) host.current?.focus({ preventScroll: true });
  }, [active, overlayOpen]);

  useEffect(() => {
    let disposed = false;
    let instance: { setActive: (paused: boolean) => void; setCharacter: (character: Character) => void; resetKeyboard: () => void; destroy: () => void } | undefined;
    const element = host.current;
    if (!element) return;
    const contextLost = (event: Event) => { event.preventDefault(); callbacks.current.onError(); };
    element.addEventListener('webglcontextlost', contextLost, true);
    import('./createGame').then(({ createGame }) => {
      if (disposed) return;
      instance = createGame(element, latest.current.character, bridge, {
        onReady: () => {
          // Phaser may call back during startup; wait until its controller has been assigned.
          queueMicrotask(() => {
            if (disposed) return;
            ready.current = true;
            instance?.setCharacter(latest.current.character);
            instance?.setActive(!latest.current.active || latest.current.overlayOpen);
            if (latest.current.active && !latest.current.overlayOpen) element.focus({ preventScroll: true });
            callbacks.current.onReady();
          });
        },
        onTarget: target => { if (!disposed) callbacks.current.onTarget(target); },
        onInteract: target => { if (!disposed) callbacks.current.onInteract(target); },
        onError: () => { if (!disposed) callbacks.current.onError(); },
      });
      controller.current = instance;
      instance.setCharacter(latest.current.character);
    }).catch(() => { if (!disposed) callbacks.current.onError(); });
    return () => { disposed = true; ready.current = false; element.removeEventListener('webglcontextlost', contextLost, true); if (controller.current === instance) controller.current = null; instance?.destroy(); };
  }, [bridge]);

  return <div id="adventure-world" className="game-canvas" ref={host} role="img" tabIndex={0} onPointerDown={() => host.current?.focus({ preventScroll: true })} onBlur={() => controller.current?.resetKeyboard()} onKeyDown={event => { if (event.target === event.currentTarget && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault(); }} aria-label="A small explorable town. Use arrow keys or WASD to move and E or Enter to interact." />;
}
