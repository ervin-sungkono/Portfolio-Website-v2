import { describe, expect, test } from 'vitest';
import {
  activeSlideForProgress,
  slideOpacityForProgress,
} from '@/components/home/ScrollHero/progress';

describe('hero slide progression', () => {
  test('zero or one slide never selects a second slide', () => {
    for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
      expect(activeSlideForProgress(progress, 0)).toBe(0);
      expect(activeSlideForProgress(progress, 1)).toBe(0);
      expect(slideOpacityForProgress(progress, 0, 1)).toBe(1);
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
});
