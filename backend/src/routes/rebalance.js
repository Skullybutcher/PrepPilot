// Phase 4c — Rebalance suggestion routes
// GET  /api/rebalance/latest   — returns the pending suggestion or null
// POST /api/rebalance/approve  — marks the pending suggestion approved
//
// Phase 5b update: prefers SQLite DB (getLatestSuggestion / approveSuggestion)
// and falls back to latest-rebalance.json for compatibility.

import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const LATEST_PATH = path.resolve('src/data/latest-rebalance.json');

function readJsonLatest() {
  try {
    return JSON.parse(fs.readFileSync(LATEST_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJsonLatest(suggestion) {
  fs.mkdirSync(path.dirname(LATEST_PATH), { recursive: true });
  fs.writeFileSync(LATEST_PATH, JSON.stringify(suggestion, null, 2) + '\n', 'utf-8');
}

// GET /api/rebalance/latest
// Returns null (200) if no file/DB row exists or the suggestion was already approved.
// Returns the suggestion object if approved === false.
router.get('/latest', async (req, res) => {
  // Try DB first, fall back to JSON file
  let suggestion = null;
  try {
    const { getLatestSuggestion } = await import('../db/index.js');
    suggestion = getLatestSuggestion();
  } catch {
    suggestion = readJsonLatest();
  }

  if (!suggestion || suggestion.approved === true) {
    return res.json(null);
  }
  res.json(suggestion);
});

// POST /api/rebalance/approve
// Sets approved: true in DB (and JSON file for consistency), logs options, returns { ok: true }.
router.post('/approve', async (req, res) => {
  let suggestion = null;
  let useDb = false;

  try {
    const { getLatestSuggestion, approveSuggestion } = await import('../db/index.js');
    suggestion = getLatestSuggestion();
    if (suggestion) {
      useDb = true;
      approveSuggestion(suggestion.id);
    }
  } catch {
    // DB not available — fall back to JSON
  }

  if (!suggestion) {
    suggestion = readJsonLatest();
    if (!suggestion) {
      return res.status(404).json({ error: 'No pending suggestion found' });
    }
  }

  if (suggestion.approved === true) {
    return res.json({ ok: true }); // idempotent
  }

  // Also update JSON file for consistency
  suggestion.approved = true;
  writeJsonLatest(suggestion);

  console.log('Rebalance suggestion approved:');
  suggestion.options.forEach((opt, i) => {
    console.log(`  ${i + 1}. [${opt.track}] ${opt.change}`);
    console.log(`     ${opt.rationale}`);
  });

  res.json({ ok: true });
});

export default router;
