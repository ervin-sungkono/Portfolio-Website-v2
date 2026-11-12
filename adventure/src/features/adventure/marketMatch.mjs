export const MARKET_ITEMS = [
  { id: 'tree', label: 'Tree', image: '/game/drafts/prop-tree.png' },
  { id: 'fountain', label: 'Fountain', image: '/game/decor/fountain.png' },
  { id: 'mailbox', label: 'Mailbox', image: '/game/decor/mailbox.png' },
  { id: 'bench', label: 'Bench', image: '/game/drafts/prop-bench.png' },
  { id: 'flowerpot', label: 'Flowerpot', image: '/game/drafts/prop-flowerpot.png' },
  { id: 'lantern', label: 'Lantern', image: '/game/decor/lantern.png' },
];

/** @typedef {{ cards: typeof MARKET_ITEMS, revealed: number[], matched: number[], attempts: number, message: string }} MatchRound */

/** Deal six pairs; injectable randomness makes the shuffle testable. @returns {MatchRound} */
export function newMarketRound(random = Math.random) {
  const cards = MARKET_ITEMS.flatMap(item => [item, item]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, revealed: [], matched: [], attempts: 0, message: 'Turn over two cards to find a pair.' };
}

/** @param {MatchRound} round @param {number} index @returns {MatchRound} */
export function chooseMarketCard(round, index) {
  if (!Number.isInteger(index) || index < 0 || index >= round.cards.length || round.revealed.length > 1 || round.revealed.includes(index) || round.matched.includes(index)) return round;
  const card = round.cards[index];
  if (!round.revealed.length) return { ...round, revealed: [index], message: `${card.label} revealed. Find its match.` };
  const first = round.revealed[0];
  const attempts = round.attempts + 1;
  if (round.cards[first].id === card.id) {
    const matched = [...round.matched, first, index];
    return { ...round, revealed: [], matched, attempts, message: matched.length === round.cards.length ? `All pairs found in ${attempts} ${attempts === 1 ? 'try' : 'tries'}!` : `${card.label} matched. ${matched.length / 2} of ${MARKET_ITEMS.length} pairs found.` };
  }
  return { ...round, revealed: [first, index], attempts, message: `${round.cards[first].label} and ${card.label} do not match. Try again.` };
}

/** @param {MatchRound} round @returns {MatchRound} */
export function hideMarketPair(round) {
  return round.revealed.length === 2 ? { ...round, revealed: [] } : round;
}
