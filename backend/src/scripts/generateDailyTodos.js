// Phase 2: Run once per day (cron / GitHub Actions schedule).
// Usage: npm run generate:today

import fs from 'node:fs/promises';
import path from 'node:path';
import { createIssue, searchIssues, projectKey } from '../jira/client.js';
import { getCurrentQuarter, isRecoveryWeek, getDayType } from '../generator/pace.js';
import { getNextProblems } from '../generator/striver.js';
import roadmap from '../config/roadmap.config.json' with { type: 'json' };

const STRIVER_PATH = path.resolve('src/data/striver-a2z.json');

async function loadStriverSheet() {
  const raw = await fs.readFile(STRIVER_PATH, 'utf-8');
  return JSON.parse(raw);
}

/** Find today's Story issue for a given track label, so subtasks nest correctly. */
async function findStoryForTrack(track, quarterId) {
  const jql = `project = ${projectKey} AND labels = "${track}" AND summary ~ "${quarterId}" AND issuetype = Story`;
  const result = await searchIssues(jql, ['summary']);
  return result.issues?.[0] ?? null;
}

/** Idempotency guard: skip if today's todos were already generated. */
async function alreadyGeneratedToday(today) {
  const dateStr = today.toISOString().slice(0, 10);
  const jql = `project = ${projectKey} AND summary ~ "[${dateStr}]" AND issuetype = Subtask`;
  const result = await searchIssues(jql, ['summary']);
  return (result.issues?.length ?? 0) > 0;
}

async function main() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);

  if (await alreadyGeneratedToday(today)) {
    console.log(`Todos for ${dateStr} already exist in Jira. Skipping (idempotent).`);
    return;
  }

  const { quarter, weekNumber } = getCurrentQuarter(roadmap, today);
  if (!quarter) {
    console.log('No active quarter found for today\'s date — check roadmap.config.json startDate.');
    return;
  }

  const recovery = isRecoveryWeek(roadmap, weekNumber);
  const dayType = getDayType(today);
  const striverSheet = await loadStriverSheet();

  const tasksToCreate = [];

  // DSA task — always included, pulled from Striver sheet in order.
  const nextProblems = getNextProblems(striverSheet, 2);
  if (nextProblems.length > 0) {
    const names = nextProblems.map((p) => `${p.stepName} > ${p.name}`).join('; ');
    tasksToCreate.push({
      track: 'DSA',
      summary: `[${dateStr}] DSA: ${names}`,
    });
  }

  // Fundamentals task, if this quarter/day includes it.
  if (quarter.tracks.Fundamentals && dayType !== 'saturday') {
    tasksToCreate.push({
      track: 'Fundamentals',
      summary: `[${dateStr}] Fundamentals: ${quarter.tracks.Fundamentals.focus} (1 hr)`,
    });
  }

  // Saturday: project-focused day.
  if (dayType === 'saturday' && quarter.tracks.Project && !recovery) {
    tasksToCreate.push({
      track: 'Project',
      summary: `[${dateStr}] Project: ${quarter.tracks.Project.focus}`,
    });
  }

  // Sunday: system design / revision, once past Q1.
  if (dayType === 'sunday' && quarter.tracks.SystemDesign && !recovery) {
    tasksToCreate.push({
      track: 'SystemDesign',
      summary: `[${dateStr}] System Design: ${quarter.tracks.SystemDesign.focus}`,
    });
  }

  if (tasksToCreate.length === 0) {
    console.log('No tasks generated for today — check roadmap config for this quarter/day type.');
    return;
  }

  console.log(`Generating ${tasksToCreate.length} tasks for ${dateStr} (Week ${weekNumber}, ${quarter.id}${recovery ? ', RECOVERY WEEK' : ''})...`);

  for (const task of tasksToCreate) {
    const story = await findStoryForTrack(task.track, quarter.id);
    if (!story) {
      console.warn(`  No Jira Story found for track "${task.track}" in ${quarter.id} — run setup:jira first. Skipping.`);
      continue;
    }
    const subtask = await createIssue({
      summary: task.summary,
      issueType: "10006", // Subtask
      parentKey: story.key,
      labels: [task.track, 'daily-todo'],
    });
    console.log(`  Created ${subtask.key}: ${task.summary}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Daily generation failed:', err.message);
  process.exit(1);
});
