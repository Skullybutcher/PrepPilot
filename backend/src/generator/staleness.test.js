import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStaleCards } from './staleness.js';

const now = new Date('2026-09-01');

test('flags a card as stale when its last transition is >= 14 days ago', () => {
  const issues = [
    { key: 'RC-1', status: 'To Do', lastTransitionDate: '2026-08-15T00:00:00.000Z' }, // 17 days
  ];
  const result = findStaleCards(issues, { now });
  assert.equal(result.length, 1);
  assert.equal(result[0].key, 'RC-1');
  assert.equal(result[0].daysStale, 17);
});

test('does not flag a card transitioned recently', () => {
  const issues = [
    { key: 'RC-2', status: 'In Progress', lastTransitionDate: '2026-08-28T00:00:00.000Z' }, // 4 days
  ];
  assert.equal(findStaleCards(issues, { now }).length, 0);
});

test('never flags a Done card, regardless of transition date', () => {
  const issues = [
    { key: 'RC-3', status: 'Done', lastTransitionDate: '2026-07-01T00:00:00.000Z' },
  ];
  assert.equal(findStaleCards(issues, { now }).length, 0);
});

test('respects a custom staleDays threshold', () => {
  const issues = [
    { key: 'RC-4', status: 'To Do', lastTransitionDate: '2026-08-25T00:00:00.000Z' }, // 7 days
  ];
  assert.equal(findStaleCards(issues, { now, staleDays: 14 }).length, 0);
  assert.equal(findStaleCards(issues, { now, staleDays: 5 }).length, 1);
});
