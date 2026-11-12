import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextDialogueStep, visibleChoices } from '../src/features/adventure/dialogueModel.mjs';

const dialogues = JSON.parse(readFileSync(new URL('../src/content/dialogues.json', import.meta.url), 'utf8'));

test('hobby question appears only when personal interests exist', () => {
  const options = dialogues['background-guide'].nodes.welcome.options;
  assert.equal(visibleChoices(options, false).some(option => option.next === 'hobbies'), false);
  assert.equal(visibleChoices(options, true).some(option => option.next === 'hobbies'), true);
  assert.ok(visibleChoices(options, false).some(option => option.next === 'about'));
});

test('each guide can answer a question and return to the start', () => {
  for (const tree of Object.values(dialogues)) {
    const initial = tree.nodes[tree.start];
    for (const choice of initial.options) {
      assert.ok(tree.nodes[choice.next], `missing destination ${choice.next}`);
      assert.ok(tree.nodes[choice.next].options.some(option => option.next === tree.start), `no route back from ${choice.next}`);
    }
  }
});

test('typing reveals characters in order and pauses at punctuation', () => {
  const characters = Array.from('Hi, friend!');
  let visible = 0;
  const steps = [];
  while (visible < characters.length) {
    const step = nextDialogueStep(characters, visible);
    assert.ok(step.visible > visible && step.visible <= characters.length);
    steps.push({ text: characters.slice(visible, step.visible).join(''), delay: step.delay });
    visible = step.visible;
  }
  assert.equal(steps.map(step => step.text).join(''), 'Hi, friend!');
  assert.ok(steps.find(step => step.text.endsWith(',')).delay > steps[0].delay);
  assert.ok(steps.find(step => step.text.endsWith('!')).delay > steps[0].delay);
  assert.equal(nextDialogueStep(characters, characters.length).visible, characters.length);
});
