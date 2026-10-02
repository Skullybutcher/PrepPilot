// Phase 4 (FR6, trigger half only — no NIM call yet): run weekly (cron /
// GitHub Actions schedule). Computes this week's WeeklyCheckIn — per-track
// pace with a consecutive-behind streak, plus any stale cards — and decides
// whether the combined trigger fires. Persists history so next week's run
// can tell whether a track is behind for the first time or the second.
//
// This intentionally stops at "did it trigger, and why" — it does not call
// NIM to generate a RebalanceSuggestion yet. That's the next piece, once
// this detection layer is confirmed to behave correctly against real data.
//
// Usage: npm run check:weekly

import fs from 'node:fs/promises';
import path from 'node:path';
import { getLoggedHoursByTrack, fetchOpenIssuesWithTransitionDates } from '../jira/velocity.js';
import { findStaleCards } from '../generator/staleness.js';
import { buildWeeklyCheckIn } from '../generator/weeklyCheckIn.js';
import { generateRebalanceSuggestion } from '../generator/rebalanceSuggestion.js';
import { getCurrentQuarter } from '../generator/pace.js';
import { insertCheckIn, insertSuggestion } from '../db/index.js';
import roadmap from '../config/roadmap.config.json' with { type: 'json' };

const HISTORY_PATH = path.resolve('src/data/weekly-checkins.json');
const SUGGESTIONS_PATH = path.resolve('src/data/rebalance-suggestions.json');
const LATEST_REBALANCE_PATH = path.resolve('src/data/latest-rebalance.json');
const LOOKBACK_DAYS = 7;
const STALE_DAYS = 1;

async function loadHistory() {
  try {
    const raw = await fs.readFile(HISTORY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return []; // first run — no history yet
    throw err;
  }
}

async function saveHistory(history) {
  await fs.writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf-8');
}

async function loadSuggestions() {
  try {
    const raw = await fs.readFile(SUGGESTIONS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function saveSuggestions(suggestions) {
  await fs.writeFile(SUGGESTIONS_PATH, JSON.stringify(suggestions, null, 2) + '\n', 'utf-8');
}

function printSuggestion(suggestion) {
  console.log('\nRebalance suggestion (pending approval):');
  suggestion.options.forEach((opt, i) => {
    console.log(`  ${i + 1}. [${opt.track}] ${opt.change}`);
    console.log(`     ${opt.rationale}`);
  });
}

function printSummary(checkIn) {
  console.log(`\nWeek ${checkIn.weekNumber} (${checkIn.date})`);
  for (const [track, t] of Object.entries(checkIn.tracks)) {
    const streak = t.consecutiveBehind > 0 ? ` — behind ${t.consecutiveBehind}wk streak` : '';
    console.log(`  ${track}: ${t.status} (${t.logged}h / ${t.target}h, ratio ${t.ratio})${streak}`);
  }
  if (checkIn.staleCards.length > 0) {
    console.log('  Stale cards:');
    checkIn.staleCards.forEach((c) => console.log(`    ${c.key} [${c.track}] — ${c.daysStale}d untouched: ${c.summary}`));
  }
  console.log(checkIn.triggered ? `\n⚠ Trigger fired (${checkIn.triggers.length} reason(s)):` : '\nNo trigger this week.');
  checkIn.triggers.forEach((t) =>
    console.log(
      t.reason === 'off-pace'
        ? `  - ${t.track} off-pace for ${t.consecutiveBehind} consecutive weeks (ratio ${t.ratio})`
        : `  - ${t.track} card ${t.key} stale for ${t.daysStale} days: ${t.summary}`
    )
  );
}

async function main() {
  const today = new Date();
  const { quarter, weekNumber } = getCurrentQuarter(roadmap, today);
  if (!quarter) {
    console.log("No active quarter found for today's date — check roadmap.config.json startDate.");
    return;
  }

  console.log(`Running weekly rebalance check for Week ${weekNumber} (${quarter.id})...`);

  const [loggedHoursByTrack, openIssues] = await Promise.all([
    getLoggedHoursByTrack(LOOKBACK_DAYS),
    fetchOpenIssuesWithTransitionDates(),
  ]);

  const staleCards = findStaleCards(openIssues, { staleDays: STALE_DAYS, now: today });

  const history = await loadHistory();
  const checkIn = buildWeeklyCheckIn({ quarter, weekNumber, loggedHoursByTrack, staleCards, history });

  printSummary(checkIn);

  history.push(checkIn);
  await saveHistory(history);
  insertCheckIn(checkIn);
  console.log(`\nSaved to ${HISTORY_PATH}.`);

  if (checkIn.triggered) {
    console.log('\nCalling NIM for a rebalance suggestion...');
    try {
      const suggestion = await generateRebalanceSuggestion(checkIn);
      printSuggestion(suggestion);

      const suggestions = await loadSuggestions();
      suggestions.push(suggestion);
      await saveSuggestions(suggestions);
      console.log(`Saved to ${SUGGESTIONS_PATH} (approved: false — dashboard/CLI approval flow not yet built).`);

      insertSuggestion(suggestion);
      // Write latest-rebalance.json so the dashboard can surface it immediately
      await fs.writeFile(LATEST_REBALANCE_PATH, JSON.stringify(suggestion, null, 2) + '\n', 'utf-8');
      console.log(`Latest suggestion written to ${LATEST_REBALANCE_PATH}.`);
    } catch (err) {
      // Detection already succeeded and is persisted above — a NIM failure
      // here shouldn't be treated as the whole run failing. Fail loudly via
      // log per SPEC.md's reliability principle, but don't throw.
      console.error(`\nNIM call failed, no suggestion generated this run: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error('Weekly rebalance check failed:', err.message);
  process.exit(1);
});
