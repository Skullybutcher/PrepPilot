// I/O layer for the weekly rebalancing trigger (FR6). Pure decision logic
// lives in ../generator/staleness.js and ../generator/weeklyCheckIn.js —
// this file is only responsible for turning Jira API calls into the plain
// data shapes those pure functions expect.

import { searchIssues, getWorklogs, getIssueChangelog, projectKey } from './client.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Track labels are applied at issue-creation time (see setupJiraProject.js
 * and generateDailyTodos.js) and are exactly the track names from
 * roadmap.config.json (DSA, Fundamentals, CloudCert, Project, OpenSource,
 * SystemDesign, InterviewPrep). 'daily-todo' and 'preppilot' are
 * bookkeeping labels, not tracks, so they're filtered out here.
 */
const NON_TRACK_LABELS = new Set(['daily-todo', 'preppilot']);

function trackFromLabels(labels = []) {
  return labels.find((l) => !NON_TRACK_LABELS.has(l)) ?? null;
}

/**
 * Sum hours logged per track over the last `lookbackDays`, from Jira
 * worklogs. Uses JQL's `worklogDate >=` to narrow down to issues with any
 * recent worklog activity server-side, then fetches each candidate issue's
 * worklog entries to sum only the ones that actually fall inside the
 * window (JQL's worklogDate filter matches the issue, not which specific
 * entries are recent).
 */
export async function getLoggedHoursByTrack(lookbackDays = 7) {
  const jql = `project = ${projectKey} AND issuetype in (Story, Subtask) AND worklogDate >= -${lookbackDays}d`;
  const result = await searchIssues(jql, ['labels']);
  const issues = result.issues ?? [];

  const cutoff = Date.now() - lookbackDays * MS_PER_DAY;
  const hoursByTrack = {};

  for (const issue of issues) {
    const track = trackFromLabels(issue.fields.labels);
    if (!track) continue;

    const { worklogs = [] } = await getWorklogs(issue.key);
    const seconds = worklogs
      .filter((w) => new Date(w.started).getTime() >= cutoff)
      .reduce((sum, w) => sum + w.timeSpentSeconds, 0);

    hoursByTrack[track] = (hoursByTrack[track] ?? 0) + seconds / 3600;
  }

  for (const track of Object.keys(hoursByTrack)) {
    hoursByTrack[track] = Number(hoursByTrack[track].toFixed(2));
  }

  return hoursByTrack;
}

/** Most recent status-transition date for an issue, via its changelog. */
async function getLastTransitionDate(issue) {
  const changelog = await getIssueChangelog(issue.key);
  const statusChangeDates = (changelog.values ?? [])
    .filter((entry) => entry.items.some((item) => item.field === 'status'))
    .map((entry) => entry.created);

  if (statusChangeDates.length === 0) {
    // Never transitioned since creation — falls back to created date.
    return issue.fields.created;
  }
  return statusChangeDates.sort().at(-1);
}

/**
 * All open (non-Done) tracked issues, each with its track label and last
 * real status-transition date — the input the staleness check needs.
 */
export async function fetchOpenIssuesWithTransitionDates() {
  const jql = `project = ${projectKey} AND issuetype in (Story, Subtask) AND status != Done`;
  const result = await searchIssues(jql, ['summary', 'status', 'labels', 'created']);
  const issues = result.issues ?? [];

  const withDates = [];
  for (const issue of issues) {
    const lastTransitionDate = await getLastTransitionDate(issue);
    withDates.push({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      track: trackFromLabels(issue.fields.labels),
      lastTransitionDate,
    });
  }
  return withDates;
}
