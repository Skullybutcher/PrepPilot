import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRebalanceSuggestion, validateOptions, generateDeterministic } from './rebalanceSuggestion.js';

const triggeredCheckIn = {
  weekNumber: 5,
  date: '2026-08-08',
  tracks: {
    DSA: { status: 'behind', ratio: 0.6, consecutiveBehind: 2 },
    System_Design: { status: 'on-pace', ratio: 1.0, consecutiveBehind: 0 },
  },
  staleCards: [],
  triggered: true,
  triggers: [{ reason: 'off-pace', track: 'DSA', consecutiveBehind: 2, ratio: 0.6 }],
};

function fakeChat(response) {
  return async () => JSON.stringify(response);
}

// ---------------------------------------------------------------------------
// Existing tests
// ---------------------------------------------------------------------------

test('rejects a non-triggered WeeklyCheckIn without calling NIM', async () => {
  const checkIn = { ...triggeredCheckIn, triggered: false };
  await assert.rejects(
    () => generateRebalanceSuggestion(checkIn, { chat: async () => { throw new Error('should not be called'); } }),
    /non-triggered/
  );
});

test('returns a well-formed RebalanceSuggestion on a valid NIM response', async () => {
  const chat = fakeChat({
    options: [
      { track: 'DSA', change: 'Drop daily target from 5 to 3 problems for one week', rationale: 'DSA is behind 2 consecutive weeks at 60% of required pace.' },
    ],
  });

  const suggestion = await generateRebalanceSuggestion(triggeredCheckIn, { chat });

  assert.equal(suggestion.date, '2026-08-08');
  assert.equal(suggestion.weekNumber, 5);
  assert.equal(suggestion.approved, false);
  assert.equal(suggestion.options.length, 1);
  assert.equal(suggestion.options[0].track, 'DSA');
});

test('accepts 2 options', async () => {
  const chat = fakeChat({
    options: [
      { track: 'DSA', change: 'a', rationale: 'r' },
      { track: 'general', change: 'b', rationale: 'r2' },
    ],
  });
  const suggestion = await generateRebalanceSuggestion(triggeredCheckIn, { chat });
  assert.equal(suggestion.options.length, 2);
});

test('throws on invalid JSON from NIM', async () => {
  const chat = async () => 'not json';
  await assert.rejects(() => generateRebalanceSuggestion(triggeredCheckIn, { chat }), /invalid JSON/);
});

test('strips leaked thinking text and parses trailing JSON object', async () => {
  const chat = async () => [
    'thinking: I should rebalance DSA first {draft}',
    '{"options":[{"track":"DSA","change":"Shift one DSA session to fundamentals this week","rationale":"DSA has been behind for multiple weeks and needs a temporary load adjustment."}]}'
  ].join('\n');

  const suggestion = await generateRebalanceSuggestion(triggeredCheckIn, { chat });
  assert.equal(suggestion.options.length, 1);
  assert.equal(suggestion.options[0].track, 'DSA');
});

test('throws when NIM returns 0 options', async () => {
  const chat = fakeChat({ options: [] });
  await assert.rejects(() => generateRebalanceSuggestion(triggeredCheckIn, { chat }), /1-2 options/);
});

test('throws when NIM returns 3+ options', async () => {
  const chat = fakeChat({
    options: [
      { track: 'DSA', change: 'a', rationale: 'r' },
      { track: 'DSA', change: 'b', rationale: 'r' },
      { track: 'DSA', change: 'c', rationale: 'r' },
    ],
  });
  await assert.rejects(() => generateRebalanceSuggestion(triggeredCheckIn, { chat }), /1-2 options/);
});

test('throws when an option is missing a required field', async () => {
  const chat = fakeChat({ options: [{ track: 'DSA', change: 'a' }] }); // no rationale
  await assert.rejects(() => generateRebalanceSuggestion(triggeredCheckIn, { chat }), /Malformed option/);
});

test('validateOptions is exported and usable directly', () => {
  const options = validateOptions({ options: [{ track: 'DSA', change: 'a', rationale: 'r' }] });
  assert.equal(options.length, 1);
});

// ---------------------------------------------------------------------------
// New injected-client tests (B1 requirement)
// ---------------------------------------------------------------------------

test('valid first response — returns options array correctly', async () => {
  const expected = { track: 'DSA', change: 'Reduce sessions to 3/week', rationale: 'Behind for 2 weeks at 60%.' };
  const chat = fakeChat({ options: [expected] });

  const suggestion = await generateRebalanceSuggestion(triggeredCheckIn, { chat });

  assert.equal(suggestion.options.length, 1);
  assert.deepEqual(suggestion.options[0], expected);
  assert.equal(suggestion.approved, false);
});

test('empty first response triggers corrective retry and returns valid result', async () => {
  let callCount = 0;
  const validOption = { track: 'DSA', change: 'Lower daily target', rationale: 'Two weeks behind at 60%.' };

  const chat = async ({ messages }) => {
    callCount++;
    // First call returns empty options; second call (corrective retry) returns valid
    if (callCount === 1) return JSON.stringify({ options: [] });
    return JSON.stringify({ options: [validOption] });
  };

  const suggestion = await generateRebalanceSuggestion(triggeredCheckIn, { chat });

  assert.equal(suggestion.options.length, 1);
  assert.deepEqual(suggestion.options[0], validOption);
  assert.ok(callCount >= 2, `Expected at least 2 calls, got ${callCount}`);
});

test('transient ECONNRESET on first call — backoff — success on retry', async () => {
  let callCount = 0;
  const validOption = { track: 'DSA', change: 'Reduce load this week', rationale: 'Recovery from connection failure.' };

  const chat = async () => {
    callCount++;
    if (callCount === 1) throw Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' });
    return JSON.stringify({ options: [validOption] });
  };

  const suggestion = await generateRebalanceSuggestion(triggeredCheckIn, { chat });

  assert.equal(suggestion.options.length, 1);
  assert.deepEqual(suggestion.options[0], validOption);
  assert.ok(callCount >= 2, `Expected retry after ECONNRESET, got ${callCount} call(s)`);
});

test('all candidate models return empty — throws containing "All candidate NIM models failed"', async () => {
  // Every call returns empty options — both primary and fallback models fail
  const chat = fakeChat({ options: [] });

  await assert.rejects(
    () => generateRebalanceSuggestion(triggeredCheckIn, { chat }),
    /All candidate NIM models failed/
  );
});

// ---------------------------------------------------------------------------
// generateDeterministic — module-scope export test
// ---------------------------------------------------------------------------

test('generateDeterministic is exported and produces valid options', () => {
  const result = generateDeterministic(triggeredCheckIn);
  assert.ok(Array.isArray(result.options), 'result.options should be an array');
  assert.ok(result.options.length >= 1, 'should produce at least 1 option');
  assert.equal(typeof result.options[0].track, 'string');
  assert.equal(typeof result.options[0].change, 'string');
  assert.equal(typeof result.options[0].rationale, 'string');
});
