// Pure logic, no I/O — easy to unit test. Builds the WeeklyCheckIn record
// (Section 7 of SPEC.md) and decides whether FR6's combined trigger fires:
// a track off-pace for 2+ consecutive check-ins, OR any stale card, OR both.

import { computeTrackPace } from './pace.js';

/** Last recorded consecutive-behind count for a track, from history. */
function priorStreak(history, track) {
  if (history.length === 0) return 0;
  const last = history[history.length - 1];
  return last.tracks?.[track]?.consecutiveBehind ?? 0;
}

/**
 * Build this week's check-in from current pace/staleness data plus prior
 * history (used only to carry forward each track's consecutive-behind
 * count — everything else is computed fresh from this week's data).
 *
 * @param {object} quarter - current quarter from roadmap.config.json
 * @param {number} weekNumber
 * @param {object} loggedHoursByTrack - { DSA: 8.5, ... }, from jira/velocity.js
 * @param {object[]} staleCards - from generator/staleness.js#findStaleCards
 * @param {object[]} history - prior WeeklyCheckIn records, oldest first
 */
export function buildWeeklyCheckIn({ quarter, weekNumber, loggedHoursByTrack, staleCards, history = [] }) {
  const paceByTrack = computeTrackPace(quarter, loggedHoursByTrack);

  const tracks = {};
  for (const [track, pace] of Object.entries(paceByTrack)) {
    const consecutiveBehind = pace.status === 'behind' ? priorStreak(history, track) + 1 : 0;
    tracks[track] = { ...pace, consecutiveBehind };
  }

  const offPaceTriggers = Object.entries(tracks)
    .filter(([, t]) => t.consecutiveBehind >= 2)
    .map(([track, t]) => ({
      reason: 'off-pace',
      track,
      consecutiveBehind: t.consecutiveBehind,
      ratio: t.ratio,
    }));

  const staleTriggers = staleCards.map((card) => ({
    reason: 'stale',
    track: card.track,
    key: card.key,
    summary: card.summary,
    daysStale: card.daysStale,
  }));

  const triggers = [...offPaceTriggers, ...staleTriggers];

  return {
    weekNumber,
    date: new Date().toISOString().slice(0, 10),
    tracks,
    staleCards,
    triggered: triggers.length > 0,
    triggers,
  };
}
