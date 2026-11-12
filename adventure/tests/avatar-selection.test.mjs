import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAvatarSelection } from '../src/features/adventure/avatarSelection.mjs';

test('the latest choice is applied when the scene becomes ready and on later changes', () => {
  const avatar = createAvatarSelection('male');
  const rendered = [];
  avatar.set('female');
  avatar.set('male');
  avatar.set('female');
  avatar.bind(character => rendered.push(character));
  assert.deepEqual(rendered, ['female']);
  avatar.set('male');
  avatar.set('male');
  assert.deepEqual(rendered, ['female', 'male']);
  assert.equal(avatar.current(), 'male');
  avatar.destroy();
  avatar.set('female');
  assert.deepEqual(rendered, ['female', 'male']);
  assert.equal(avatar.current(), 'male');
});
