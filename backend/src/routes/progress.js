import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { searchIssues } from '../jira/client.js';

const router = Router();
const STRIVER_PATH = path.resolve('src/data/striver-a2z.json');
const CONFIG_PATH = path.resolve('src/config/roadmap.config.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActiveQuarter(config) {
  const today = new Date();
  const startDate = new Date(config.startDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceStart = Math.max(0, Math.floor((today - startDate) / msPerDay));
  const weekNumber = Math.ceil(daysSinceStart / 7) || 1;

  const quarter = config.quarters.find(
    (q) => weekNumber >= q.startWeek && weekNumber <= q.endWeek
  );
  return { quarter, weekNumber };
}

/**
 * Compute streak: number of consecutive calendar days (going backward from
 * today) where at least one Jira subtask was transitioned to Done.
 * Uses JQL: issuetype = Subtask AND status = Done AND updated >= -14d
 * and deduplicates by date string, then counts backward from today.
 */
async function computeStreak() {
  try {
    const jql = `issuetype = Subtask AND status = Done AND updated >= -14d ORDER BY updated DESC`;
    const result = await searchIssues(jql, ['updated']);
    const issues = result.issues ?? [];

    // Collect unique YYYY-MM-DD dates (UTC) where a Done subtask was updated
    const doneDates = new Set(
      issues.map((issue) => {
        const d = new Date(issue.fields.updated);
        return d.toISOString().slice(0, 10);
      })
    );

    // Count consecutive days backward from today
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      if (doneDates.has(dateStr)) {
        streak++;
      } else {
        break; // first gap — stop
      }
    }
    return streak;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// GET /api/progress
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const [sheet, config] = await Promise.all([
      fs.readFile(STRIVER_PATH, 'utf-8').then(JSON.parse),
      fs.readFile(CONFIG_PATH, 'utf-8').then(JSON.parse),
    ]);

    // DSA — step-by-step
    let total = 0, done = 0;
    const byStep = sheet.steps.map((step) => {
      let stepTotal = 0, stepDone = 0;
      step.subSteps.forEach((sub) =>
        sub.problems.forEach((p) => {
          stepTotal++; total++;
          if (p.status === 'done') { stepDone++; done++; }
        })
      );
      return { stepId: step.stepId, stepName: step.stepName, done: stepDone, total: stepTotal };
    });

    // Active quarter tracks
    const { quarter } = getActiveQuarter(config);
    let tracks = [];
    if (quarter && quarter.tracks) {
      tracks = Object.entries(quarter.tracks).map(([name, cfg]) => ({
        name,
        weeklyHours: cfg.weeklyHours,
        focus: cfg.focus,
        status: 'on-pace', // real pace calculation deferred until WeeklyCheckIn history exists
      }));
    }

    // Streak — best-effort; falls back to 0 on Jira errors
    const streak = await computeStreak();

    res.json({
      dsa: { done, total, percent: Math.round((done / total) * 100), byStep },
      tracks,
      streak,
    });
  } catch (err) {
    console.error('Failed to compute progress:', err.message);
    res.status(500).json({ error: 'Failed to compute progress' });
  }
});

export default router;
