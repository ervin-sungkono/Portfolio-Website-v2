import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cafeTree } from '../src/features/adventure/cafeModel.mjs';

test('each available café topic opens its answer and leads back to the menu', () => {
  const content = JSON.parse(readFileSync('src/content/cafe.json', 'utf8'));
  const tree = cafeTree(content);
  const entries = [...content.townTopics, ...content.personalTopics].filter(item => item && typeof item.question === 'string' && item.question.trim() && typeof item.answer === 'string' && item.answer.trim());
  assert.equal(tree.start, 'welcome');
  assert.equal(tree.nodes.welcome.options.length, entries.length);
  for (const [index, option] of tree.nodes.welcome.options.entries()) {
    assert.equal(tree.nodes[option.next].text, entries[index].answer);
    assert.equal(tree.nodes[option.next].options[0].next, tree.start);
  }
});

test('personal topics can be added without publishing empty or incomplete answers', () => {
  const tree = cafeTree({ greeting: 'Welcome!', townTopics: [], personalTopics: [
    null,
    {},
    { question: 'Favourite hobby?', answer: '' },
    { question: 'A real story?', answer: 'A story supplied by the owner.' },
  ] });
  assert.deepEqual(tree.nodes.welcome.options, [{ label: 'A real story?', next: 'topic-0' }]);
  assert.equal(tree.nodes['topic-0'].text, 'A story supplied by the owner.');
  const empty = cafeTree({ townTopics: [], personalTopics: [] });
  assert.deepEqual(empty.nodes.welcome.options, []);
  assert.match(empty.nodes.welcome.text, /more stories/i);
});
