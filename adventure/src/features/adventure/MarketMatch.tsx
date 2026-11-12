'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MARKET_ITEMS, chooseMarketCard, hideMarketPair, newMarketRound } from './marketMatch.mjs';
import './market-match.css';

const COLUMNS = 4;

export default function MarketMatch() {
  const [round, setRound] = useState(() => newMarketRound());
  const [focusIndex, setFocusIndex] = useState(0);
  const cards = useRef<Array<HTMLButtonElement | null>>([]);
  const pairs = round.matched.length / 2;
  const complete = pairs === MARKET_ITEMS.length;

  useEffect(() => {
    if (round.revealed.length !== 2) return;
    const timeout = window.setTimeout(() => setRound(hideMarketPair), 1050);
    return () => window.clearTimeout(timeout);
  }, [round.revealed]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const row = Math.floor(index / COLUMNS), column = index % COLUMNS;
    let next = index;
    if (event.key === 'ArrowLeft' && column > 0) next--;
    else if (event.key === 'ArrowRight' && column < COLUMNS - 1) next++;
    else if (event.key === 'ArrowUp' && row > 0) next -= COLUMNS;
    else if (event.key === 'ArrowDown' && index + COLUMNS < round.cards.length) next += COLUMNS;
    if (next === index) return;
    setFocusIndex(next);
    cards.current[next]?.focus();
  }

  return <section className="market-match" aria-label="Market Match game">
    <p className="market-match-intro">A little market mix-up! Turn over two cards and find the matching pairs. There’s no rush.</p>
    <div className="market-match-score"><span>PAIRS <strong>{pairs}/{MARKET_ITEMS.length}</strong></span><span>TRIES <strong>{round.attempts}</strong></span><button type="button" onClick={() => { setRound(newMarketRound()); setFocusIndex(0); }}>New game ↻</button></div>
    <p className="market-match-help">Use arrow keys to move between cards, then Enter or Space to turn one over.</p>
    <div className="market-match-grid" role="grid" aria-label="Twelve cards; find six matching pairs">
      {Array.from({ length: round.cards.length / COLUMNS }, (_, row) => <div className="market-match-row" role="row" key={row}>
        {round.cards.slice(row * COLUMNS, (row + 1) * COLUMNS).map((card, column) => {
          const index = row * COLUMNS + column;
          const matched = round.matched.includes(index);
          const visible = matched || round.revealed.includes(index);
          return <div role="gridcell" key={index}>
            <button type="button" ref={element => { cards.current[index] = element; }} className={`market-card${visible ? ' market-card-visible' : ''}${matched ? ' market-card-matched' : ''}`} tabIndex={focusIndex === index ? 0 : -1} aria-disabled={matched || round.revealed.includes(index) || round.revealed.length === 2} aria-label={`Row ${row + 1}, column ${column + 1}: ${visible ? `${card.label}${matched ? ', matched' : ', revealed'}` : 'hidden card'}`} onFocus={() => setFocusIndex(index)} onKeyDown={event => moveFocus(event, index)} onClick={() => setRound(current => chooseMarketCard(current, index))}>
              {visible ? <img src={card.image} alt="" draggable={false} /> : <span className="market-card-back" aria-hidden="true">✦</span>}
              {matched && <span className="market-card-check" aria-hidden="true">✓</span>}
            </button>
          </div>;
        })}
      </div>)}
    </div>
    <p className="sr-only" role="status" aria-live="polite">{round.message}</p>
    {complete && <div className="market-match-win" role="status"><span aria-hidden="true">✦ &nbsp; ✦ &nbsp; ✦</span><strong>What a lovely match!</strong><small>You found every pair in {round.attempts} {round.attempts === 1 ? 'try' : 'tries'}.</small></div>}
  </section>;
}
