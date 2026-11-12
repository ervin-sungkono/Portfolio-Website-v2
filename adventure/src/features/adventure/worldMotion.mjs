// Regions are in the original 96×128 explorer frame coordinates. Each isolates
// the part of the hair that can sway without moving the character's feet.
const femaleHair = {
  down: { x: 0, y: 0, width: 39, height: 57 },
  left: { x: 57, y: 0, width: 39, height: 60 },
  up: { x: 16, y: 0, width: 64, height: 49 },
  right: { x: 0, y: 0, width: 39, height: 60 },
};
const maleHair = { x: 0, y: 0, width: 96, height: 25 };

/** Return four stationary slices and a separately animated hair slice. */
export function hairSlices(character, facing) {
  const region = character === 'female' ? (femaleHair[facing] ?? femaleHair.down) : maleHair;
  const { x, y, width, height } = region;
  return [
    { x: 0, y: 0, width: 96, height: y },
    { x: 0, y, width: x, height },
    { x: x + width, y, width: 96 - x - width, height },
    { x: 0, y: y + height, width: 96, height: 128 - y - height },
    region,
  ];
}

/** A four-step sway stays in time with the existing walk animation. */
export function hairSway(frameIndex, character) {
  const step = [0, 1, 0, -1][((frameIndex - 1) % 4 + 4) % 4];
  return step * (character === 'female' ? 1.1 : 0.55);
}
