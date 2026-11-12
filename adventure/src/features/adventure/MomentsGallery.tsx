'use client';

import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import content from '@/content/moments.json';
import './moments.css';

type Photo = { image: string; alt: string; caption: string; date?: string; story?: string };
const photos: Photo[] = content.photos;

type Props = {
  close: () => void;
  dialog: RefObject<HTMLDivElement | null>;
  trap: (event: KeyboardEvent<HTMLDivElement>) => void;
  initialIndex?: number | null;
};

export default function MomentsGallery({ close, dialog, trap, initialIndex = null }: Props) {
  const [selected, setSelected] = useState<number | null>(() => initialIndex !== null && Number.isInteger(initialIndex) && initialIndex >= 0 && initialIndex < photos.length ? initialIndex : null);
  const detail = useRef<HTMLHeadingElement>(null);
  const tiles = useRef<Array<HTMLButtonElement | null>>([]);
  const photo = selected === null ? null : photos[selected];

  const openPhoto = (index: number) => {
    setSelected(index);
    requestAnimationFrame(() => detail.current?.focus({ preventScroll: true }));
  };
  const backToGallery = () => {
    const previous = selected;
    setSelected(null);
    if (previous !== null) requestAnimationFrame(() => tiles.current[previous]?.focus({ preventScroll: true }));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && selected !== null) {
      event.stopPropagation();
      backToGallery();
      return;
    }
    if (selected !== null && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      setSelected(Math.max(0, Math.min(photos.length - 1, selected + (event.key === 'ArrowRight' ? 1 : -1))));
    }
    trap(event);
  };

  return <div className="modal-scrim moments-scrim" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="info-panel pixel-dialog moments-panel" role="dialog" aria-modal="true" aria-labelledby="moments-title" tabIndex={-1} ref={dialog} onKeyDown={onKeyDown}>
      <div className="panel-top pixel-banner"><div className="moments-emblem" aria-hidden="true">✦</div><div className="panel-banner-copy"><span className="pixel-kicker">✦ &nbsp; A LITTLE PHOTO ALBUM</span><strong>MOMENTS</strong></div><button className="icon-button pixel-close" onClick={close} aria-label="Close moments">×</button></div>
      <div className="moments-content">
        {photo ? <>
          <button className="moments-back" onClick={backToGallery}>← All moments</button>
          <figure className="moments-detail">
            <div className="moments-detail-image"><img src={photo.image} alt={photo.alt} decoding="async" /></div>
            <figcaption aria-live="polite"><h2 id="moments-title" ref={detail} tabIndex={-1}>{photo.caption}</h2>{photo.date && <p className="moments-date">{photo.date}</p>}{photo.story && <p className="moments-story">{photo.story}</p>}</figcaption>
          </figure>
          {photos.length > 1 && <nav className="moments-navigation" aria-label="Browse moments"><button className="button secondary" aria-disabled={selected === 0} onClick={() => setSelected(Math.max(0, selected! - 1))}>← Previous</button><span aria-live="polite">{selected! + 1} / {photos.length}</span><button className="button secondary" aria-disabled={selected === photos.length - 1} onClick={() => setSelected(Math.min(photos.length - 1, selected! + 1))}>Next →</button></nav>}
        </> : <>
          <span className="moments-kicker">THE LITTLE THINGS, THE BIG ADVENTURES</span>
          <h2 id="moments-title">Moments worth keeping.</h2>
          <p className="moments-intro">A little collection of experiences and memories from my corner of the world.</p>
          {photos.length ? <div className="moments-grid">{photos.map((item, index) => <button type="button" className="moments-tile" key={`${item.image}-${index}`} ref={element => { tiles.current[index] = element; }} onClick={() => openPhoto(index)} aria-label={`View photo: ${item.caption}`}>
            <span className="moments-tile-image"><img src={item.image} alt="" loading="eager" fetchPriority={index < 6 ? 'auto' : 'low'} decoding="async" /></span><span className="moments-tile-copy"><strong>{item.caption}</strong>{item.date && <small>{item.date}</small>}</span>
          </button>)}</div> : <div className="moments-empty"><span aria-hidden="true">✧</span><strong>The album is waiting for its first moment.</strong><p>Come back soon for photos and stories.</p></div>}
        </>}
      </div>
    </div>
  </div>;
}
