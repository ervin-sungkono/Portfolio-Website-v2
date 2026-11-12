export const DIRECTIONS = Object.freeze(['down', 'left', 'up', 'right']);
export const BLINK_IDLE = 20;
export const BLINK_WALK = 21;

/** Each direction has an idle pose followed by four walking poses. */
export function explorerFrame(direction, walkFrame = -1) {
  const index = DIRECTIONS.indexOf(direction);
  if (index < 0 || !Number.isInteger(walkFrame) || walkFrame < -1 || walkFrame > 3) throw new Error('Invalid explorer animation frame');
  return index * 5 + (walkFrame + 1);
}
