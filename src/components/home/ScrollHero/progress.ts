const fadeStart = 0.2;
const fadeEnd = 0.8;
const throwDistance = 240;
const throwRotation = 12;
const enterDistance = 1.25;

function slidePosition(progress: number, count: number) {
  if (count <= 1) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(count - 1, ((progress - fadeStart) / (fadeEnd - fadeStart)) * (count - 1)),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rounded(value: number) {
  return Number(value.toFixed(3));
}

export function activeSlideForProgress(progress: number, count: number) {
  if (count <= 1) {
    return 0;
  }
  return nearestSlideForProgress(progress, count);
}

export function slideOpacityForProgress(progress: number, index: number, count: number) {
  return Math.max(0, 1 - Math.abs(slidePosition(progress, count) - index));
}

export function slideAnchorProgress(index: number, count: number) {
  if (count <= 1) {
    return 0;
  }
  return fadeStart + ((fadeEnd - fadeStart) * index) / (count - 1);
}

export function nearestSlideForProgress(progress: number, count: number) {
  if (count <= 1) {
    return 0;
  }
  for (let index = 1; index < count; index += 1) {
    const boundary = fadeStart + ((index - 0.5) * (fadeEnd - fadeStart)) / (count - 1);
    if (progress < boundary) {
      return index - 1;
    }
  }
  return count - 1;
}

export function slideTransformForProgress(progress: number, index: number, count: number) {
  if (count <= 1) {
    return 'translate3d(0, 0, 0) rotate(0deg)';
  }

  const position = slidePosition(progress, count);
  if (position < index) {
    const entering = clamp(position - index + 1, 0, 1);
    const offset = rounded(enterDistance * (1 - entering));
    if (offset === 0) {
      return 'translate3d(0, 0, 0) rotate(0deg)';
    }
    return `translate3d(0, ${offset}rem, 0)`;
  }

  const leaving = clamp(position - index, 0, 1);
  if (leaving === 0) {
    return 'translate3d(0, 0, 0) rotate(0deg)';
  }

  const distance = rounded(throwDistance * leaving);
  const rotation = rounded(throwRotation * leaving);
  if (distance === 0 && rotation === 0) {
    return 'translate3d(0, 0, 0) rotate(0deg)';
  }
  return `translate3d(${distance}%, 0, 0) rotate(${rotation}deg)`;
}
