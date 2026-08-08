// Pure logic, no I/O — easy to unit test. Takes the plain issue shape
// produced by jira/velocity.js#fetchOpenIssuesWithTransitionDates.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A card is stale if it isn't Done and hasn't had a real status change in
 * `staleDays` days. This is independent of whether the track it belongs to
 * is otherwise on-pace — a track can look fine in aggregate while one card
 * rots for two weeks.
 */
export function findStaleCards(issues, { staleDays = 14, now = new Date() } = {}) {
  return issues
    .filter((issue) => issue.status !== 'Done')
    .map((issue) => {
      const daysStale = Math.floor((now - new Date(issue.lastTransitionDate)) / MS_PER_DAY);
      return { ...issue, daysStale };
    })
    .filter((issue) => issue.daysStale >= staleDays);
}
