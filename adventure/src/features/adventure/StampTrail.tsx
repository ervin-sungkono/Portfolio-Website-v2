'use client';

import type { KeyboardEvent, RefObject } from 'react';
import { TRAIL_STOPS, trailComplete } from './stampTrailModel.mjs';
import type { useStampTrail } from './useStampTrail';
import './stamp-trail.css';

type Trail = ReturnType<typeof useStampTrail>;

/** A compact progress control; its parent decides where it fits in the HUD. */
export function StampTrailButton({ trail, open }: { trail: Trail; open: () => void }) {
  const count = trail.progress.stamps.length;
  return <button type="button" className="stamp-trail-button" onClick={open} aria-label={`Open stamp trail: ${count} of ${TRAIL_STOPS.length} stamps`}>
    <span aria-hidden="true">✦</span> <span>Trail</span> <strong>{count}/{TRAIL_STOPS.length}</strong>
  </button>;
}

type Props = {
  trail: Trail;
  close: () => void;
  dialog: RefObject<HTMLDivElement | null>;
  trap: (event: KeyboardEvent<HTMLDivElement>) => void;
  startAt?: string;
};

export function StampTrailPanel({ trail, close, dialog, trap, startAt }: Props) {
  const { progress } = trail;
  const complete = trailComplete(progress);
  const count = progress.stamps.length;
  return <div className="modal-scrim" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="info-panel pixel-dialog stamp-trail-panel" role="dialog" aria-modal="true" aria-labelledby="stamp-trail-title" tabIndex={-1} ref={dialog} onKeyDown={trap}>
      <div className="panel-top pixel-banner"><div className="stamp-trail-seal" aria-hidden="true">✦</div><div className="panel-banner-copy"><span className="pixel-kicker">✦ &nbsp; A LITTLE TOWN ADVENTURE</span><strong>MILO’S STAMP TRAIL</strong></div><button className="icon-button pixel-close" onClick={close} aria-label="Close stamp trail">×</button></div>
      <div className="panel-content">
        {complete ? <>
          <h2 id="stamp-trail-title">A postcard for you</h2>
          <div className="stamp-postcard"><span className="stamp-postcard-mark" aria-hidden="true">✦</span><small>FROM MILO · THE LITTLE TOWN</small><strong>What a lovely wander!</strong><p>You found every stop on the trail. Thanks for exploring this little corner of the world.</p><span>See you around, explorer! ♡</span></div>
          <p className="stamp-trail-note">All {TRAIL_STOPS.length} stamps collected. Your postcard stays on this device.</p>
          <div className="stamp-trail-actions"><button className="button primary" onClick={close}>Back to exploring →</button><button className="button secondary" onClick={() => { trail.restart(startAt); close(); }}>Start again</button></div>
        </> : <>
          <h2 id="stamp-trail-title">A little trail around town</h2>
          <p className="lead">Collect a stamp at each stop and Milo has a little postcard for you. There’s no timer—take your time!</p>
          <div className="stamp-trail-progress"><span>YOUR STAMPS</span><strong>{count} / {TRAIL_STOPS.length}</strong></div>
          <progress aria-label="Stamp trail progress" value={count} max={TRAIL_STOPS.length} />
          <ol className="stamp-trail-list">{TRAIL_STOPS.map(stop => {
            const collected = progress.stamps.includes(stop.id);
            return <li key={stop.id} className={collected ? 'collected' : ''}><span className="stamp-trail-stamp" aria-hidden="true">{collected ? '✦' : '◇'}</span><div><strong>{stop.name}</strong><p>{collected ? 'Stamp collected!' : stop.clue}</p></div></li>;
          })}</ol>
          <p className="stamp-trail-note">{progress.active ? 'Your trail is active. Interact with each stop to collect its stamp.' : count ? 'Your stamps are saved here. Resume whenever you like.' : 'Start the trail whenever you’re ready.'}</p>
          <div className="stamp-trail-actions">{progress.active ? <><button className="button primary" onClick={close}>Keep exploring →</button><button className="button secondary" onClick={() => { trail.pause(); close(); }}>Pause trail</button></> : <button className="button primary" onClick={() => { trail.start(startAt); close(); }}>{count ? 'Resume trail →' : 'Start the trail →'}</button>}</div>
        </>}
      </div>
    </div>
  </div>;
}
