import { describe, expect, test } from 'vitest';
import {
  activeSlideForProgress,
  nearestSlideForProgress,
  slideAnchorProgress,
  slideOpacityForProgress,
  slideTransformForProgress,
} from '@/components/home/ScrollHero/progress';

describe('hero slide progression', () => {
  test('zero or one slide never selects a second slide', () => {
    for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
      expect(activeSlideForProgress(progress, 0)).toBe(0);
      expect(activeSlideForProgress(progress, 1)).toBe(0);
      expect(slideOpacityForProgress(progress, 0, 1)).toBe(1);
      expect(slideTransformForProgress(progress, 0, 1)).toBe('translate3d(0, 0, 0) rotate(0deg)');
    }
  });

  test('two slides retain the 20–80% crossfade and 50% active switch', () => {
    expect(slideOpacityForProgress(0.2, 0, 2)).toBe(1);
    expect(slideOpacityForProgress(0.2, 1, 2)).toBe(0);
    expect(slideOpacityForProgress(0.5, 0, 2)).toBeCloseTo(0.5);
    expect(slideOpacityForProgress(0.5, 1, 2)).toBeCloseTo(0.5);
    expect(activeSlideForProgress(0.499, 2)).toBe(0);
    expect(activeSlideForProgress(0.5, 2)).toBe(1);
    expect(slideOpacityForProgress(0.8, 0, 2)).toBe(0);
    expect(slideOpacityForProgress(0.8, 1, 2)).toBe(1);
  });

  test('settles to the nearest fully visible anchor for three slides', () => {
    expect(slideAnchorProgress(0, 3)).toBeCloseTo(0.2);
    expect(slideAnchorProgress(1, 3)).toBeCloseTo(0.5);
    expect(slideAnchorProgress(2, 3)).toBeCloseTo(0.8);
    expect(nearestSlideForProgress(0.32, 3)).toBe(0);
    expect(nearestSlideForProgress(0.36, 3)).toBe(1);
    expect(nearestSlideForProgress(0.64, 3)).toBe(1);
    expect(nearestSlideForProgress(0.66, 3)).toBe(2);
  });

  test.each([3, 4])('%i slides crossfade adjacent previews in either direction', (count) => {
    const positions = Array.from(
      { length: count },
      (_, index) => 0.2 + (0.6 * index) / (count - 1),
    );
    for (const [index, progress] of positions.entries()) {
      expect(activeSlideForProgress(progress, count)).toBe(index);
      expect(slideOpacityForProgress(progress, index, count)).toBeCloseTo(1);
      for (let other = 0; other < count; other += 1) {
        if (other !== index) {
          expect(slideOpacityForProgress(progress, other, count)).toBeCloseTo(0);
        }
      }
    }
    const forward = positions.map((progress) => activeSlideForProgress(progress, count));
    const reverse = [...positions]
      .reverse()
      .map((progress) => activeSlideForProgress(progress, count));
    expect(reverse).toEqual([...forward].reverse());
  });

  test.each([2, 3, 4])('%i slides throw and float through each transition', (count) => {
    const transitionLength = 0.6 / (count - 1);

    for (let index = 0; index < count - 1; index += 1) {
      const start = 0.2 + transitionLength * index;
      const middle = start + transitionLength / 2;
      const end = start + transitionLength;

      expect(slideTransformForProgress(start, index, count)).toBe(
        'translate3d(0, 0, 0) rotate(0deg)',
      );
      expect(slideTransformForProgress(start, index + 1, count)).toBe('translate3d(0, 1.25rem, 0)');
      expect(slideTransformForProgress(middle, index, count)).toBe(
        'translate3d(120%, 0, 0) rotate(6deg)',
      );
      expect(slideTransformForProgress(middle, index + 1, count)).toBe(
        'translate3d(0, 0.625rem, 0)',
      );
      expect(slideTransformForProgress(end, index, count)).toBe(
        'translate3d(240%, 0, 0) rotate(12deg)',
      );
      expect(slideTransformForProgress(end, index + 1, count)).toBe(
        'translate3d(0, 0, 0) rotate(0deg)',
      );
    }
  });
});
