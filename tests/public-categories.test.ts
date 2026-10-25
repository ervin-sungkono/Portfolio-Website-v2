import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublishedCategoryLabels } from '../src/lib/cms/public-categories.ts';

test('public category labels follow taxonomy order and include only published references', () => {
  const snapshot = {
    categories: {
      data: {
        'z-shared': { label: 'Shared', sortOrder: 10 },
        later: { label: 'Later', sortOrder: 20 },
        'a-shared': { label: 'Shared', sortOrder: 10 },
        middle: { label: 'Middle', sortOrder: 10 },
        earliest: { label: 'Earliest', sortOrder: 2 },
        hidden: { label: 'Hidden', sortOrder: 0 },
        unused: { label: 'Unused', sortOrder: 0 },
      },
    },
    projects: [
      {
        data: {
          published: true,
          categories: ['z-shared', 'later', 'a-shared', 'middle', 'earliest'],
        },
      },
      { data: { published: false, categories: ['hidden'] } },
    ],
  };

  assert.deepEqual(getPublishedCategoryLabels(snapshot), ['Earliest', 'Shared', 'Middle', 'Later']);
});
