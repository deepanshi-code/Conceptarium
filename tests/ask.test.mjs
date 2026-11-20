import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, SUBJECTS } from '../js/catalog.js';
import { QUIZ } from '../js/quiz.js';
import { GENERATORS, seeded } from '../js/practice/problems.js';
import { buildDocs, buildIndex, search, stem, tokenize } from '../js/ask/engine.js';

const docs = buildDocs({ catalog: CATALOG, subjects: SUBJECTS, quiz: QUIZ, practice: GENERATORS, seeded });
const index = buildIndex(docs);
const top = (q, current) => search(index, q, { current })[0]?.doc;

test('stemming and tokenizing', () => {
  assert.equal(stem('bending'), stem('bend'));
  assert.equal(stem('gases'), 'gas');
  assert.equal(stem('running'), 'run');
  assert.deepEqual(tokenize('What is the <b>BMD</b>?'), ['bmd']);
  assert.ok(tokenize('bmd', { expand: true }).includes(stem('bending')));
});

test('every concept is searchable by its own title', () => {
  for (const c of CATALOG) assert.equal(top(c.title)?.path, c.path, c.title);
});

test('typical student questions find the right concept and kind of answer', () => {
  assert.equal(top('what is bending moment').path, 'beam');
  assert.deepEqual([top('how to find max BMD').path, top('how to find max BMD').kind], ['beam', 'example']);
  assert.equal(top('round robin scheduling').path, 'scheduling');
  assert.equal(top('what happens in mitosis').path, 'mitosis');
  assert.equal(top('learning rate too high').path, 'descent');
  assert.equal(top('difference between first angle and third angle').path, 'drawing');
});

test('questions without a topic answer about the open concept', () => {
  assert.deepEqual([top('how do I use this', 'circuits').path, top('how do I use this', 'circuits').kind], ['circuits', 'steps']);
  assert.deepEqual([top('solve an example', 'gaslaws').path, top('solve an example', 'gaslaws').kind], ['gaslaws', 'example']);
});

test('off-topic questions get no answer instead of a random one', () => {
  assert.equal(search(index, 'why is the sky blue').length, 0);
  assert.equal(search(index, 'who won the cricket match').length, 0);
  assert.equal(search(index, '').length, 0);
});

test('quiz passages show the right option', () => {
  const d = docs.find((x) => x.kind === 'quiz' && x.path === 'beam');
  assert.ok(d.html.includes('PL/4'));
});
