import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyCheckIn } from './weeklyCheckIn.js';

const quarter = { tracks: { DSA: { weeklyHours: 10 }, Project: { weeklyHours: 3 } } };

test('does not trigger on a single behind week (needs 2+ consecutive)', () => {
  const result = buildWeeklyCheckIn({
    quarter,
    weekNumber: 3,
    loggedHoursByTrack: { DSA: 5, Project: 3 }, // DSA behind (50%)
    staleCards: [],
    history: [],
  });
  assert.equal(result.tracks.DSA.consecutiveBehind, 1);
  assert.equal(result.triggered, false);
});

test('triggers off-pace after 2 consecutive behind weeks', () => {
  const priorWeek = buildWeeklyCheckIn({
    quarter,
    weekNumber: 3,
    loggedHoursByTrack: { DSA: 5, Project: 3 },
    staleCards: [],
    history: [],
  });

  const result = buildWeeklyCheckIn({
    quarter,
    weekNumber: 4,
    loggedHoursByTrack: { DSA: 4, Project: 3 }, // DSA behind again
    staleCards: [],
    history: [priorWeek],
  });

  assert.equal(result.tracks.DSA.consecutiveBehind, 2);
  assert.equal(result.triggered, true);
  assert.equal(result.triggers[0].reason, 'off-pace');
  assert.equal(result.triggers[0].track, 'DSA');
});

test('a single stale card triggers on its own, even with every track on-pace', () => {
  const result = buildWeeklyCheckIn({
    quarter,
    weekNumber: 5,
    loggedHoursByTrack: { DSA: 10, Project: 3 }, // both on-pace
    staleCards: [{ key: 'RC-9', track: 'Project', summary: 'Stale card', daysStale: 16 }],
    history: [],
  });

  assert.equal(result.triggered, true);
  assert.equal(result.triggers.length, 1);
  assert.equal(result.triggers[0].reason, 'stale');
});

test('resets a track\'s streak back to 0 the week it recovers to on-pace', () => {
  const behindWeek = buildWeeklyCheckIn({
    quarter,
    weekNumber: 3,
    loggedHoursByTrack: { DSA: 5, Project: 3 },
    staleCards: [],
    history: [],
  });

  const recoveredWeek = buildWeeklyCheckIn({
    quarter,
    weekNumber: 4,
    loggedHoursByTrack: { DSA: 10, Project: 3 }, // back on pace
    staleCards: [],
    history: [behindWeek],
  });

  assert.equal(recoveredWeek.tracks.DSA.consecutiveBehind, 0);
  assert.equal(recoveredWeek.triggered, false);
});
