import { generateRebalanceSuggestion } from './src/generator/rebalanceSuggestion.js';

// Prefer mistral-nemotron for this test
process.env.NIM_MODEL_LIST = 'nvidia/nemotron-3-nano-30b-a3b,mistralai/mistral-nemotron';

const checkIn = {
  weekNumber: 1,
  date: '2026-08-11',
  tracks: { DSA: { status: 'behind', ratio: 0, consecutiveBehind: 12 } },
  staleCards: [],
  triggered: true,
  triggers: [{ reason: 'off-pace', track: 'DSA', consecutiveBehind: 12, ratio: 0 }]
};

try {
  const res = await generateRebalanceSuggestion(checkIn);
  console.log('SUGGESTION:', JSON.stringify(res, null, 2));
} catch (e) {
  console.error('FAILED:', e.message);
}
