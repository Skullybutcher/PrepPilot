// Phase 5b — SQLite store for WeeklyCheckIn and RebalanceSuggestion history.
// Uses better-sqlite3 (synchronous API — appropriate for a personal, single-writer tool).
//
// DB location: process.env.DB_PATH || './data/roadmap.db'
// The `data/` directory is created automatically if it doesn't exist.

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || './data/roadmap.db';

let _db = null;

export function getDb() {
  if (_db) return _db;

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  _db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_checkins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT    NOT NULL,
      week_number   INTEGER NOT NULL,
      payload       TEXT    NOT NULL,
      triggered     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rebalance_suggestions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT    NOT NULL,
      week_number   INTEGER NOT NULL,
      options       TEXT    NOT NULL,
      approved      INTEGER NOT NULL DEFAULT 0
    );
  `);

  return _db;
}

// ---------------------------------------------------------------------------
// WeeklyCheckIn helpers
// ---------------------------------------------------------------------------

/**
 * Insert a WeeklyCheckIn record.
 * @param {object} checkIn - full WeeklyCheckIn (must have .date, .weekNumber, .triggered)
 */
export function insertCheckIn(checkIn) {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO weekly_checkins (date, week_number, payload, triggered) VALUES (?, ?, ?, ?)'
  );
  stmt.run(
    checkIn.date,
    checkIn.weekNumber,
    JSON.stringify(checkIn),
    checkIn.triggered ? 1 : 0
  );
}

// ---------------------------------------------------------------------------
// RebalanceSuggestion helpers
// ---------------------------------------------------------------------------

/**
 * Insert a RebalanceSuggestion record.
 * @param {object} suggestion - must have .date, .weekNumber, .options[]
 * @returns {number} the inserted row id
 */
export function insertSuggestion(suggestion) {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO rebalance_suggestions (date, week_number, options, approved) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(
    suggestion.date,
    suggestion.weekNumber,
    JSON.stringify(suggestion.options),
    suggestion.approved ? 1 : 0
  );
  return result.lastInsertRowid;
}

/**
 * Get the most recent unapproved suggestion, or null if none exists.
 * @returns {{ id: number, date: string, weekNumber: number, options: object[], approved: boolean }|null}
 */
export function getLatestSuggestion() {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT * FROM rebalance_suggestions WHERE approved = 0 ORDER BY id DESC LIMIT 1'
    )
    .get();
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    weekNumber: row.week_number,
    options: JSON.parse(row.options),
    approved: row.approved === 1,
  };
}

/**
 * Mark a suggestion as approved by its row id.
 * @param {number} id
 */
export function approveSuggestion(id) {
  const db = getDb();
  db.prepare('UPDATE rebalance_suggestions SET approved = 1 WHERE id = ?').run(id);
}
