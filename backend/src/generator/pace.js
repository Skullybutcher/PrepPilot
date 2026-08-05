// Pure logic, no I/O — easy to unit test.

/**
 * Given the roadmap config and today's date, find the active quarter and
 * the current week number within it.
 */
export function getCurrentQuarter(roadmap, today = new Date()) {
  const start = new Date(roadmap.startDate);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weekNumber = Math.floor((today - start) / msPerWeek) + 1;

  const quarter = roadmap.quarters.find(
    (q) => weekNumber >= q.startWeek && weekNumber <= q.endWeek
  );

  return { quarter, weekNumber };
}

/** Is this a recovery week? */
export function isRecoveryWeek(roadmap, weekNumber) {
  return weekNumber % roadmap.recoveryWeekEveryNWeeks === 0;
}

/**
 * Compare hours logged per track (from Jira worklogs, last N weeks) against
 * the weekly target from the roadmap. Returns per-track status.
 * loggedHoursByTrack: { DSA: 8, Fundamentals: 3, ... } (avg per week over lookback window)
 */
export function computeTrackPace(quarter, loggedHoursByTrack) {
  const results = {};
  for (const [track, config] of Object.entries(quarter.tracks)) {
    const logged = loggedHoursByTrack[track] ?? 0;
    const target = config.weeklyHours;
    const ratio = target > 0 ? logged / target : 1;

    let status = 'on-pace';
    if (ratio < 0.7) status = 'behind';
    else if (ratio > 1.3) status = 'ahead';

    results[track] = { logged, target, ratio: Number(ratio.toFixed(2)), status };
  }
  return results;
}

/** Given day type, pick which tracks get a task today (DSA always included). */
export function selectTracksForDay(quarter, dayType, isRecovery) {
  const allTracks = Object.keys(quarter.tracks);

  if (isRecovery) {
    return allTracks.filter((t) => t === 'DSA' || t === 'Fundamentals');
  }

  if (dayType === 'saturday') {
    return allTracks.filter((t) => t === 'Project');
  }

  if (dayType === 'sunday') {
    return allTracks.filter((t) => ['DSA', 'SystemDesign', 'Fundamentals'].includes(t));
  }

  // Weekday: DSA always, plus fundamentals, plus whichever non-DSA track is
  // furthest behind pace (picked by caller using computeTrackPace results).
  return allTracks.filter((t) => t === 'DSA' || t === 'Fundamentals');
}

export function getDayType(date = new Date()) {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}
