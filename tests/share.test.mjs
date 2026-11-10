import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, reportLink, REPO_URL } from '../js/share.js';

test('parseHash splits the route from shared settings', () => {
  const a = parseHash('#/beam?type=simply&L=8&p=42');
  assert.equal(a.path, 'beam');
  assert.equal(a.params.get('L'), '8');
  assert.equal(a.params.get('p'), '42');
  assert.equal(parseHash('#/structures/heap').path, 'structures/heap');
  assert.equal(parseHash('').path, '');
  assert.equal([...parseHash('#/gears').params].length, 0);
});

test('reportLink opens a pre-filled GitHub issue for this repo', () => {
  const url = new URL(reportLink({ title: 'Truss Bridge' }, 'https://x/#/truss?P=100'));
  assert.equal(`${url.origin}${url.pathname}`, `${REPO_URL}/issues/new`);
  assert.match(url.searchParams.get('title'), /Truss Bridge/);
  assert.match(url.searchParams.get('body'), /#\/truss\?P=100/);
});
