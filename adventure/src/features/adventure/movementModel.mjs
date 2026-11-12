const STICK_DEADZONE = 0.12;
const MIN_TOUCH_SPEED = 0.3;

/** Convert the physical thumb position into a responsive, bounded movement vector. */
export function thumbstickVector(dx, dy, radius) {
  const distance = Math.hypot(dx, dy);
  if (!distance || radius <= 0) return { x: 0, y: 0, knobX: 0, knobY: 0 };

  const reach = Math.min(distance / radius, 1);
  const directionX = dx / distance, directionY = dy / distance;
  const knobX = directionX * reach * radius, knobY = directionY * reach * radius;
  if (reach <= STICK_DEADZONE) return { x: 0, y: 0, knobX, knobY };

  // Avoid a barely visible crawl when a thumb first crosses the deadzone,
  // while retaining slower movement for small deflections.
  const travel = (reach - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  const speed = MIN_TOUCH_SPEED + (1 - MIN_TOUCH_SPEED) * Math.pow(travel, 0.7);
  return { x: directionX * speed, y: directionY * speed, knobX, knobY };
}

/** Keep diagonal and combined keyboard/touch input within the normal walking speed. */
export function movementVector(x, y) {
  const length = Math.hypot(x, y);
  const scale = length > 1 ? 1 / length : 1;
  return { x: x * scale, y: y * scale, speed: Math.min(length, 1), moving: length > 0 };
}

/** Stabilize near-diagonal touch directions so thumb jitter doesn't restart the walk. */
export function movementFacing(x, y, current, stabilize = false) {
  if (!x && !y) return current;
  const horizontal = Math.abs(x), vertical = Math.abs(y);
  if (stabilize && (current === 'left' || current === 'right') && horizontal && vertical <= horizontal * 1.2) return x < 0 ? 'left' : 'right';
  if (stabilize && (current === 'up' || current === 'down') && vertical && horizontal <= vertical * 1.2) return y < 0 ? 'up' : 'down';
  return horizontal > vertical ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
}
