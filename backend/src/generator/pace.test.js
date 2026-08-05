import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrackPace, isRecoveryWeek, getDayType } from './pace.js';

test('computeTrackPace flags a track as behind when under 70% of target', () => {
  const quarter = { tracks: { DSA: { weeklyHours: 10 } } };
  const result = computeTrackPace(quarter, { DSA: 5 });
  assert.equal(result.DSA.status, 'behind');
});

test('computeTrackPace flags a track as ahead when over 130% of target', () => {
  const quarter = { tracks: { DSA: { weeklyHours: 10 } } };
  const result = computeTrackPace(quarter, { DSA: 14 });
  assert.equal(result.DSA.status, 'ahead');
});

test('computeTrackPace flags on-pace within the normal band', () => {
  const quarter = { tracks: { DSA: { weeklyHours: 10 } } };
  const result = computeTrackPace(quarter, { DSA: 9 });
  assert.equal(result.DSA.status, 'on-pace');
});

test('isRecoveryWeek triggers on the configured cadence', () => {
  const roadmap = { recoveryWeekEveryNWeeks: 6 };
  assert.equal(isRecoveryWeek(roadmap, 6), true);
  assert.equal(isRecoveryWeek(roadmap, 7), false);
  assert.equal(isRecoveryWeek(roadmap, 12), true);
});

test('getDayType correctly identifies weekend vs weekday', () => {
  const sunday = new Date('2026-08-09'); // known Sunday
  const saturday = new Date('2026-08-08'); // known Saturday
  const monday = new Date('2026-08-10'); // known Monday
  assert.equal(getDayType(sunday), 'sunday');
  assert.equal(getDayType(saturday), 'saturday');
  assert.equal(getDayType(monday), 'weekday');
});
