# PrepPilot Handoff

Date: 2026-10-02 (updated)

## Objective

The backend weekly rebalance flow calls NVIDIA NIM at:

`https://integrate.api.nvidia.com/v1/chat/completions`

It sends a compact `WeeklyCheckIn` and expects strict JSON:

```json
{
  "options": [
    {
      "track": "DSA",
      "change": "...",
      "rationale": "..."
    }
  ]
}
```

**Model decisions are now resolved (see SPEC.md §6 and §10):**
- **FR6 (rebalancer)**: `nvidia/nemotron-3.5-lightning-30b-a3b` — Fastest 30B A3B MoE, purpose-built for specialized agentic tasks with leading domain accuracy. **This is a completely different model from the old `nemotron-3-nano-30b-a3b`** that failed. Confirmed free endpoint.
- **FR7 (plan chat)**: `nvidia/nemotron-3-ultra-550b-a55b` — 1M context window, explicitly strong at agentic reasoning and planning. Same NIM API key.
- **Fallback for FR6**: `deepseek-ai/deepseek-v4.1-flash` (552B MoE, 8B active params, fast instruction-following).
- **Fallback for FR7**: `nvidia/nemotron-3-super-120b-a12b` (also 1M context, lighter).

The original problem that prompted the handover:

```json
{"options": []}
```

This is valid JSON, so the parser is not the root cause. The model also produced occasional preamble/thinking text in earlier tests.

## Files Involved

- `backend/src/generator/rebalanceSuggestion.js`
  - Builds the NIM prompt.
  - Selects the top off-pace/stale triggers.
  - Parses and validates model output.
  - Currently contains prompt experiments, retry logic, model iteration, logging, and an optional deterministic generator.
- `backend/src/generator/rebalanceSuggestion.test.js`
  - Existing generator tests, including leaked-thinking JSON parsing coverage.
- `backend/src/nim/client.js`
  - OpenAI-compatible NIM client.
  - Reads `NIM_API_KEY` and `NIM_MODEL` from environment.
  - Uses `https://integrate.api.nvidia.com/v1`.
- `backend/.env.example`
  - Currently recommends `mistralai/mistral-nemotron`.
- `backend/logs/nim-failures.log`
  - Runtime failure log created during testing.

## Verified Results

### Previous failing models (do NOT retry these)

- `nvidia/nemotron-3-nano-30b-a3b` — reachable but consistently returned `{"options": []}` with every prompt variation tried (full payload, reduced payload, few-shot, corrective retry, `temperature: 0`, `maxTokens: 8192`).
- `mistralai/mistral-medium-3.5-128b` — HTTP 410, EOL on 2026-08-07.
- `mistralai/mistral-nemotron` — one valid response observed, then persistent `ECONNRESET` / `ENOTFOUND` network failures.

### Resolved targets

**FR6**: `nvidia/nemotron-3.5-lightning-30b-a3b`
**FR7**: `nvidia/nemotron-3-ultra-550b-a55b`

> **IMPORTANT**: `nemotron-3.5-lightning-30b-a3b` is NOT the same as `nemotron-3-nano-30b-a3b`. The Nano failed repeatedly. Lightning is a newer, faster, agentic-specialized model. Do not conflate them.

Minimal test for FR6 before any code changes:
```powershell
$env:NIM_MODEL='nvidia/nemotron-3.5-lightning-30b-a3b'
node backend/.tmp-run5.mjs
```
Expected: non-empty `options` array with `track`, `change`, `rationale` keys.

**If nemotron-3-nano-30b-a3b must be tested first** (current `.env` value): apply the prompt fix (remove empty-options escape hatch) before testing. Given its history of failing every variation, switch to Lightning immediately if it still returns `{"options":[]}`.

Fallback order: `nemotron-3.5-lightning` → `deepseek-v4.1-flash` → `FORCE_DETERMINISTIC=true`.

### Weekly check

`npm run check:weekly` completed the check-in generation, but the NIM suggestion step failed with:

`Expected 1-2 options, got 0. Raw NIM response: {"options": []}`

## Current Code State

The generator currently includes:

1. Defensive parsing that tries the full response and then scans backward for a parseable JSON object.
2. A strict prompt and few-shot example.
3. `temperature: 0` and `maxTokens: 8192`.
4. Exponential backoff for transient errors.
5. A `FORCE_DETERMINISTIC=true` mode that skips NIM and generates rule-based options.
6. A `NIM_MODEL_LIST` model iteration mechanism.
7. Failure logging to `backend/logs/nim-failures.log`.

The deterministic path was tested successfully with:

```powershell
$env:FORCE_DETERMINISTIC='true'
npm run check:weekly
```

It produced valid options for DSA and returned `approved: false`.

## Important Issues For The Next Agent

The current implementation should be reviewed before treating it as final:

1. The user does not want a generic fallback presented as the solution. The desired fix is to make the original NIM-based idea work. Determine why the model is returning empty options and use a model/prompt/API contract that actually supports this task.
2. The model-selection loop validates each response immediately. An empty-options response is treated as a failed model and moves to the next candidate. The later corrective-retry block is therefore unreachable for an empty response if every candidate fails validation.
3. `NIM_MODEL_LIST` should be parsed and passed as an explicit model parameter to `nimChat`; mutating `process.env.NIM_MODEL` during a request loop is brittle.
4. `nimChat` destructures its default `model` from `process.env.NIM_MODEL` at call time, so passing `model: modelId` is the clearer fix.
5. The default model in `backend/src/nim/client.js` was changed to `mistralai/mistral-nemotron`, but an existing `NIM_MODEL` in `.env` still overrides it. The user must update `backend/.env` or set the environment variable explicitly.
6. Network errors are independent of prompt changes. `ENOTFOUND` means DNS resolution failed; `ECONNRESET` means the connection was reset. A successful model test cannot be considered conclusive until the same model works repeatedly from the real weekly command.
7. The current repository has unrelated or previously existing dirty changes. Do not revert them. `git status` showed changes in `SPEC.md`, weekly data/scripts, and several untracked files including `SPEC.md.rej`, `.env.example.rej`, `nim-wiring.patch`, `backend/.tmp-run5.mjs`, `backend/logs/`, and generated data files.
8. The prompt file previously had a JavaScript syntax error caused by unescaped `{` inside a template literal. Confirm syntax before testing after any prompt edit.

## Recommended Next Investigation

1. Inspect the exact NIM model list available to the account using `/v1/models`.
2. Pick one currently available instruction-following model and test it repeatedly with a minimal JSON task.
3. Call it with an explicit `model` argument in `nimChat`, rather than relying on environment mutation.
4. Remove the `{"options": []}` escape hatch from the production prompt when triggers exist. It teaches the model that an empty response is acceptable.
5. Use a schema that requires `minItems: 1` if the provider/model supports structured JSON schema, rather than only `json_object`.
6. Keep the prompt short and direct. The current few-shot conversation may be confusing Nemotron because it includes a simulated assistant answer before the real user request.
7. Add a focused injected-client test for:
   - valid first response;
   - empty first response followed by valid corrective response;
   - transient HTTP error then success;
   - all candidates unavailable.
8. Run the focused test suite before another live weekly run:

```powershell
npm --prefix backend test
```

Then test the real flow:

```powershell
$env:NIM_MODEL='the-confirmed-available-model-id'
npm --prefix backend run check:weekly
```

## Useful Direct Test

From the repository root:

```powershell
Push-Location backend
@'
import { nimChat } from './src/nim/client.js';

const raw = await nimChat({
  model: process.env.NIM_MODEL,
  messages: [
    { role: 'system', content: 'Return exactly one JSON object with one option. No explanation.' },
    { role: 'user', content: 'Create one DSA rebalance option because the track is behind for 12 weeks.' }
  ],
  responseFormat: 'json_object',
  temperature: 0,
  maxTokens: 512,
});

console.log(raw);
'@ | Set-Content -Path .tmp-nim-direct.mjs -Encoding UTF8
node .tmp-nim-direct.mjs
Remove-Item .tmp-nim-direct.mjs -Force
Pop-Location
```

## Bottom Line (FR6 — Rebalancer)

The parser hardening works, but it cannot repair a semantically empty response. Nemotron consistently returned the explicitly permitted empty array, while Mistral-Nemotron once produced a valid option but later encountered network failures.

**Next action**: swap to `meta-llama/llama-4-scout`, pass model explicitly (not via env mutation in loop), remove the empty-options escape hatch from the system prompt, shorten the few-shot section, and re-run. See `plan.md` for the full ordered task list.

---

## Broader Context: What Else Is Pending

This handover previously focused only on the NIM blocker. The full pending work across all phases is documented in `plan.md` (root of repo). Summary:

### Phase 4b — FR7 Plan Chat (not started)
- Add `backend/src/routes/plan.js` with `POST /api/plan/chat`.
- Uses `nvidia/nemotron-3-ultra-550b-a55b` (1M ctx). Full `roadmap.config.json` + Striver progress summary pasted into system prompt each turn — no RAG, no embeddings. The 1M context window means no conversation ever needs to be truncated.
- Frontend: add `Plan` tab to `App.jsx` + `frontend/src/views/PlanView.jsx`.
- Approve-before-write: bot proposes a `RoadmapConfig` diff; only writes to `roadmap.config.json` on explicit user confirmation button click.
- In-session memory only (message array passed back each turn). No cross-session memory store.

### Phase 4c — Rebalance suggestion card (not started)
- Add `GET /api/rebalance/latest` route that reads the most recent `RebalanceSuggestion` (from SQLite once that's added, or from a temp JSON file until then).
- Add `RebalanceCard` component in `TodayView.jsx` — shows options with Approve/Reject buttons.
- `POST /api/rebalance/approve` writes approved change to `roadmap.config.json`.

### Phase 4d — All-track progress + streak (not started)
- `ProgressView.jsx` currently only shows DSA. Extend `/api/progress` and the view to include all 5 active tracks with hours-logged vs. planned.
- Add streak counter (consecutive days with at least one todo marked Done).

### Phase 5 — Polish + Deploy (not started)
- SQLite: install `better-sqlite3`, create `data/roadmap.db`, schema for `weekly_checkins` and `rebalance_suggestions`.
- UI: Inter font (Google Fonts CDN in `index.html`), redesign `App.css` (glassmorphism cards, gradient accents, animated progress bars, loading skeletons).
- Tests: injected-client tests for `rebalanceSuggestion.js` (valid first response; empty → corrective; transient error → retry; all models fail).
- GitHub Actions: `.github/workflows/daily-todos.yml` (cron `0 1 * * *` UTC = 6:30 IST) and `.github/workflows/weekly-rebalance.yml` (cron `0 3 * * MON` UTC = 8:30 IST Mon).
- Deploy: frontend to Vercel (`vercel --prod` from `frontend/`), backend to Render (set `PORT`, `JIRA_*`, `NIM_API_KEY` env vars in dashboard). Add UptimeRobot ping on `/api/health` every 10 min to prevent Render sleep.
- README: Mermaid architecture diagram + dashboard screenshot after UI is stable.
