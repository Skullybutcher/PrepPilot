// FR6, NIM call half. Takes a `triggered: true` WeeklyCheckIn (built by
// weeklyCheckIn.js) and asks NIM for 1-2 concrete rebalancing options.
//
// Per SPEC.md FR6: the model only ever sees this pre-computed structured
// payload — never raw Jira data or roadmap.config.json — and its job is
// narrow (produce options, not explanations or encouragement). Output must
// be strict JSON; free-form chat is a contract violation, not a style choice.

import { nimChat } from '../nim/client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_PATH = path.resolve(__dirname, '../../logs/nim-failures.log');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logFailure(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    // swallow logging errors — never let a log write hide the real failure
  }
}

const SYSTEM_PROMPT = `You are a rebalancing assistant for a personal placement-prep roadmap tracker. You will be given a WeeklyCheckIn record. Your only job is to propose 1-2 concrete rebalancing options and return EXACTLY a single JSON object and nothing else.

RESPONSE CONTRACT (must follow exactly):
- A single JSON object only. No extra text, no commentary, no trailing punctuation.
- Shape: {"options": [{"track": string, "change": string, "rationale": string}, ...]}
- "options" must contain 1 or 2 entries. Produce at least one option — prefer a conservative, minimal change over returning an empty list.

RULES:
- Use double quotes for all JSON keys and string values.
- "track" must match a key from the "tracks" object or be "general".
- "change" must be a concise actionable instruction (limit ~10 words).
- "rationale" must be a single short sentence referencing only the supplied numbers.
`;

function selectTopTriggers(triggers, limit = 5) {
  const offPace = triggers.filter((t) => t.reason === 'off-pace');
  const stale = triggers
    .filter((t) => t.reason === 'stale')
    .sort((a, b) => b.daysStale - a.daysStale);
  return [...offPace, ...stale].slice(0, limit);
}

function buildUserPrompt(checkIn) {
  // Strip history/streak bookkeeping the model doesn't need to reason about
  // beyond what's already surfaced in `triggers` — keep the payload minimal.
  const payload = {
    weekNumber: checkIn.weekNumber,
    date: checkIn.date,
    tracks: checkIn.tracks,
    triggers: selectTopTriggers(checkIn.triggers, 5),
    totalTriggerCount: checkIn.triggers.length,
  };
  return `WeeklyCheckIn:\n${JSON.stringify(payload, null, 2)}`;
}

export function validateOptions(parsed) {
  let normalized = parsed;
  if (Array.isArray(parsed)) {
    normalized = { options: parsed };
  } else if (parsed && !Array.isArray(parsed.options) && Array.isArray(parsed.suggestions)) {
    normalized = { options: parsed.suggestions };
  }
  if (!normalized || !Array.isArray(normalized.options)) {
    throw new Error('Response missing "options" array');
  }
  if (normalized.options.length < 1 || normalized.options.length > 2) {
    throw new Error(`Expected 1-2 options, got ${normalized.options.length}`);
  }
  for (const opt of normalized.options) {
    if (typeof opt.track !== 'string' || typeof opt.change !== 'string' || typeof opt.rationale !== 'string') {
      throw new Error(`Malformed option: ${JSON.stringify(opt)}`);
    }
  }
  return normalized.options;
}

function parseNimJsonResponse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    // Defensive fallback for occasional leaked "thinking" text.
    // Start at the last "{" first, then walk left to find a parseable root object.
    let idx = raw.lastIndexOf('{');
    while (idx !== -1) {
      const candidate = raw.slice(idx).trim();
      try {
        return JSON.parse(candidate);
      } catch {
        idx = raw.lastIndexOf('{', idx - 1);
      }
    }
    throw new Error(`NIM returned invalid JSON. Raw response:\n${raw}`);
  }
}

/**
 * Rule-based deterministic fallback for when LLM is unavailable.
 * Lifted to module scope so tests can reference it directly.
 */
export function generateDeterministic(checkIn) {
  const triggers = selectTopTriggers(checkIn.triggers || [], 5);
  const options = [];
  if (!triggers || triggers.length === 0) return { options: [] };

  // Primary option: address the top off-pace track
  const top = triggers.find((t) => t.reason === 'off-pace') || triggers[0];
  const trackName = top.track || 'general';
  const consecutive =
    (checkIn.tracks && checkIn.tracks[trackName] && checkIn.tracks[trackName].consecutiveBehind) ||
    top.consecutiveBehind ||
    0;
  const change = `Reduce ${trackName} weekly target by 30% for one week`;
  const rationale =
    consecutive > 0
      ? `Behind ${consecutive} week(s) suggests temporary load reduction.`
      : 'Rebalance focus based on recent signals.';
  options.push({ track: trackName, change, rationale });

  // Secondary option: stale card triage or schedule tweak
  const stale = triggers.find((t) => t.reason === 'stale');
  if (stale) {
    options.push({
      track: stale.track || trackName,
      change: `Review and reopen stale card ${stale.card || 'top stale card'}`,
      rationale: `Stale cards indicate neglected work needing triage.`,
    });
  } else if (options.length < 2) {
    options.push({
      track: trackName,
      change: `Reduce practice sessions to 3/week for ${trackName}`,
      rationale: 'Lower short-term load to recover pace.',
    });
  }

  return { options };
}

/**
 * Generate a RebalanceSuggestion for a triggered WeeklyCheckIn.
 * Throws if checkIn.triggered is false — callers should only invoke this
 * once the trigger logic in weeklyCheckIn.js has already decided to fire.
 *
 * @param {object} checkIn - a WeeklyCheckIn record with triggered: true
 * @param {object} [deps]
 * @param {typeof nimChat} [deps.chat] - injectable for testing; defaults to the real NIM client
 * @returns {Promise<{date: string, weekNumber: number, options: object[], approved: boolean}>}
 */
export async function generateRebalanceSuggestion(checkIn, { chat = nimChat } = {}) {
  if (!checkIn.triggered) {
    throw new Error('generateRebalanceSuggestion called on a non-triggered WeeklyCheckIn');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(checkIn) },
  ];

  // If forced deterministic mode is enabled, skip LLM and use rule-based generator.
  if (process.env.FORCE_DETERMINISTIC === 'true') {
    const det = generateDeterministic(checkIn);
    const options = validateOptions(det);
    return {
      date: checkIn.date,
      weekNumber: checkIn.weekNumber,
      options,
      approved: false,
    };
  }

  // Helper: call the chat function with simple exponential backoff on transient errors.
  async function callWithBackoff(callMessages, model, attempts = 3, baseDelay = 500) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        return await chat({ messages: callMessages, model, responseFormat: 'json_object', temperature: 0, maxTokens: 8192 });
      } catch (err) {
        lastErr = err;
        const msg = String((err && err.message) || err);
        // Consider these transient and retryable
        if (/ECONNRESET|ECONN|ETIMEDOUT|EAI_AGAIN|NIM API error 5|NIM API error 502|NIM API error 503|NIM API error 504/i.test(msg)) {
          const delay = baseDelay * Math.pow(2, i);
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }
        // Non-transient — rethrow immediately
        throw err;
      }
    }
    throw lastErr;
  }

  // Build prioritized model list from env vars (no env mutation inside the loop).
  const preferred = [
    process.env.NIM_REBALANCE_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b',
    process.env.NIM_REBALANCE_MODEL_FALLBACK || 'deepseek-ai/deepseek-v4.1-flash',
  ].filter(Boolean);

  let raw = null;
  let parsed = null;
  let lastError = null;

  for (const modelId of preferred) {
    const model = modelId.trim();
    try {
      raw = await callWithBackoff(messages, model);
      parsed = parseNimJsonResponse(raw);
      // Validate — if this passes, stop trying other models
      validateOptions(parsed);
      break;
    } catch (err) {
      lastError = err;
      logFailure({ attemptedModel: model, error: err.message || String(err), raw });
      raw = null;
      parsed = null;
    }
  }

  if (!parsed) {
    throw new Error(`All candidate NIM models failed. Last error: ${lastError ? lastError.message : 'no response'}`);
  }

  // If the model returned invalid/empty options, do one corrective retry with the winning model
  try {
    validateOptions(parsed);
  } catch (firstErr) {
    const correctiveMessages = [
      ...messages,
      {
        role: 'system',
        content:
          'You MUST return 1-2 options in the exact JSON structure: {"options":[{"track":"...","change":"...","rationale":"..."}]}.',
      },
    ];
    // Use the last tried model (first in preferred that responded)
    const model = preferred[0].trim();
    try {
      const raw2 = await callWithBackoff(correctiveMessages, model, 2, 300);
      const parsed2 = parseNimJsonResponse(raw2);
      try {
        validateOptions(parsed2);
        parsed = parsed2;
      } catch (secondErr) {
        logFailure({ model, error: secondErr.message || String(secondErr), firstRaw: raw, correctiveRaw: raw2 });
        throw new Error(`${firstErr.message}. Raw NIM response:\n${raw}`);
      }
    } catch (callErr) {
      logFailure({ model, error: callErr.message || String(callErr), firstRaw: raw });
      throw new Error(`${firstErr.message}. Raw NIM response:\n${raw}`);
    }
  }

  // Final options extraction
  let options;
  try {
    options = validateOptions(parsed);
  } catch (err) {
    throw new Error(`${err.message}. Raw NIM response:\n${raw}`);
  }

  return {
    date: checkIn.date,
    weekNumber: checkIn.weekNumber,
    options,
    approved: false,
  };
}
