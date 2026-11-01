const fadeStart = 0.2;
const fadeEnd = 0.8;

function slidePosition(progress: number, count: number) {
  if (count <= 1) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(count - 1, ((progress - fadeStart) / (fadeEnd - fadeStart)) * (count - 1)),
  );
}

export function activeSlideForProgress(progress: number, count: number) {
  for (let index = 1; index < count; index++) {
    const boundary = fadeStart + ((index - 0.5) * (fadeEnd - fadeStart)) / (count - 1);
    if (progress < boundary) {
      return index - 1;
    }
  }
  return Math.max(0, count - 1);
}

export function slideOpacityForProgress(progress: number, index: number, count: number) {
  return Math.max(0, 1 - Math.abs(slidePosition(progress, count) - index));
}
