/**
 * @typedef {{ label: string, next: string, requires?: 'hobbies' }} DialogueOption
 * @param {DialogueOption[]} options
 * @param {boolean} hasHobbies
 * @returns {DialogueOption[]}
 */
export function visibleChoices(options, hasHobbies) {
  return options.filter(option => option.requires !== 'hobbies' || hasHobbies);
}

/** Reveal small groups of characters, pausing slightly at natural speech breaks. */
export function nextDialogueStep(characters, current) {
  let end = current;
  while (end < characters.length && end < current + 2) {
    const character = characters[end++];
    if (/[.!?…,;:]/u.test(character)) break;
  }
  const last = characters[end - 1] ?? '';
  const delay = /[.!?…]/u.test(last) ? 220 : /[,;:]/u.test(last) ? 110 : 36;
  return { visible: end, delay };
}
