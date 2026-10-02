# RoadMap Copilot — Agent Task Division

> Read `plan.md` for full implementation details, contracts, and code shapes for every task listed here.  
> Read `handover.md` for NIM model context and known failure history.  
> Read `SPEC.md` for functional requirements.

---

## Env Variables (already set in `backend/.env`)

```
NIM_REBALANCE_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
NIM_REBALANCE_MODEL_FALLBACK=deepseek-ai/deepseek-v4.1-flash
NIM_CHAT_MODEL=nvidia/nemotron-3-ultra-550b-a55b
NIM_CHAT_MODEL_FALLBACK=nvidia/nemotron-3-super-120b-a12b
```

Use `process.env.NIM_REBALANCE_MODEL` for FR6 calls and `process.env.NIM_CHAT_MODEL` for FR7 calls. Never hardcode model IDs.

---

## Bob (IBM) — Core Logic, Backend, LLM Wiring

**Rationale**: Bob handles everything where a wrong decision cascades — NIM integration, server-side business logic, data persistence, CI/CD. These tasks require understanding the full system, careful error handling, and correctness over speed.

---

### B1 — Fix NIM Rebalancer (Phase 4a) ⚠️ First task, blocks everything else

**Files**: `backend/src/generator/rebalanceSuggestion.js`, `backend/src/generator/rebalanceSuggestion.test.js`

**What to do**:
1. Remove `process.env.NIM_MODEL = modelId.trim()` mutation inside the model loop. Pass `model` as an explicit argument through `callWithBackoff(messages, model)` → `chat({ messages, model, ... })`.
2. Update `preferred` array to read `process.env.NIM_REBALANCE_MODEL` and `process.env.NIM_REBALANCE_MODEL_FALLBACK` instead of the old `NIM_MODEL`/`NIM_MODEL_LIST` env vars.
3. Remove the clause `"If there are no triggers, return exactly {\"options\": []}."` from `SYSTEM_PROMPT` — this is called only when `triggered: true`, an empty list is never valid.
4. Remove the inline few-shot `role:'user'` / `role:'assistant'` from the `messages` array — keep system prompt + single real user message only.
5. Extract the 3 duplicated `fs.appendFileSync` logging blocks into a single `logFailure(entry)` helper function at module scope.
6. Lift `generateDeterministic` to module scope (currently nested inside the exported function — breaks testability).

**Tests to add** (injected `chat` stub pattern — see existing test file for the pattern):
- Valid first response → returns `options` array correctly.
- Empty first response → corrective retry fires → valid response returned.
- Transient `ECONNRESET` on first call → exponential backoff → success on retry.
- All candidate models return empty → throws with message containing `"All candidate NIM models failed"`.

**Validate**:
```powershell
npm --prefix backend test
$env:NIM_REBALANCE_MODEL='nvidia/nemotron-3.5-lightning-30b-a3b'
npm --prefix backend run check:weekly
```

---

### B2 — FR7 Plan Chat Backend (Phase 4b)

**Files to create**:
- `backend/src/routes/plan.js`
- Wire into `backend/src/server.js`: `app.use('/api/plan', planRouter)`

**`POST /api/plan/chat`**:
- Body: `{ messages: [{role, content}][] }`
- Load `backend/src/config/roadmap.config.json` fresh on each request (config may have been updated).
- Load `backend/src/data/striver-a2z.json`, compute per-step `{ stepId, stepName, done, total }` summary.
- Build system prompt: role description + full config JSON stringified + striver summary.
- Call `nimChat` with `model: process.env.NIM_CHAT_MODEL`, `maxTokens: 4096`, no `responseFormat` (free text).
- If response contains a ` ```json\n...\n``` ` fenced block, extract and JSON-parse it as `proposedConfig`.
- Return `{ reply: string, proposedConfig?: object }`.
- If `nimChat` throws, try `process.env.NIM_CHAT_MODEL_FALLBACK` before surfacing the error.

**`POST /api/plan/apply`**:
- Body: `{ config: object }`
- Validate: must have `startDate` (string), `quarters` (array, non-empty), `recoveryWeekEveryNWeeks` (number).
- Write atomically: stringify → write to `roadmap.config.json.tmp` → `fs.renameSync` to `roadmap.config.json`.
- Return `{ ok: true }`.

---

### B3 — Rebalance Suggestion Persistence + Routes (Phase 4c backend)

**Files to create**: `backend/src/routes/rebalance.js`  
**Files to modify**: `backend/src/scripts/weeklyRebalanceCheck.js`, `backend/src/server.js`

**`weeklyRebalanceCheck.js`**: After `generateRebalanceSuggestion` succeeds, write the result to `backend/src/data/latest-rebalance.json`.

**`GET /api/rebalance/latest`**:
- Read `latest-rebalance.json`. Return `null` (200 OK) if file doesn't exist or `approved === true`.
- Return the suggestion object if `approved === false`.

**`POST /api/rebalance/approve`**:
- Set `approved: true` in `latest-rebalance.json`.
- Log the approved option(s) text to console (full config rewrite deferred to Phase 5+).
- Return `{ ok: true }`.

Mount: `app.use('/api/rebalance', rebalanceRouter)` in `server.js`.

---

### B4 — All-Track Progress + Streak (Phase 4d backend)

**File**: `backend/src/routes/progress.js`

**Current**: only returns DSA data.  
**Add**:
1. Load `roadmap.config.json`. Find the active quarter: week number = `Math.ceil((today - startDate) / 7)`, match against `startWeek`/`endWeek`.
2. Return `tracks: [{ name, weeklyHours, focus, status: 'on-pace'|'behind'|'ahead' }]` for the active quarter's tracks. Status can be `'on-pace'` for all tracks as a stub — real pace calculation deferred to when `WeeklyCheckIn` history exists.
3. Return `streak: N` — query Jira for subtasks transitioned to Done in the last 14 days using JQL: `project = "${JIRA_PROJECT_KEY}" AND issuetype = Subtask AND status = Done AND updated >= -14d ORDER BY updated DESC`. Collect `updated` fields, parse to date strings (`YYYY-MM-DD`), deduplicate, then count consecutive days from today backward until the first gap.

---

### B5 — SQLite Store (Phase 5b)

**Install**: `npm --prefix backend install better-sqlite3`

**Create**: `backend/src/db/index.js`

Schema:
```sql
CREATE TABLE IF NOT EXISTS weekly_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  payload TEXT NOT NULL,   -- JSON stringified WeeklyCheckIn
  triggered INTEGER NOT NULL  -- 0 or 1
);

CREATE TABLE IF NOT EXISTS rebalance_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  options TEXT NOT NULL,   -- JSON stringified options array
  approved INTEGER NOT NULL DEFAULT 0
);
```

Export: `getDb()`, `insertCheckIn(checkIn)`, `insertSuggestion(suggestion)`, `getLatestSuggestion()`, `approveSuggestion(id)`.

DB path: `process.env.DB_PATH || './data/roadmap.db'`. Create `data/` directory if it doesn't exist.

After this: update `weeklyRebalanceCheck.js` to call `insertCheckIn` and `insertSuggestion`. Update `GET /api/rebalance/latest` to prefer DB over JSON file.

---

### B6 — GitHub Actions CI/CD (Phase 5c)

**Create**: `.github/workflows/daily-todos.yml`

```yaml
name: Daily Todo Generation
on:
  schedule:
    - cron: '0 1 * * *'   # 06:30 IST
  workflow_dispatch:
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: backend
      - run: npm run generate:today
        working-directory: backend
        env:
          JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
          JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
          JIRA_PROJECT_KEY: ${{ secrets.JIRA_PROJECT_KEY }}
```

**Create**: `.github/workflows/weekly-rebalance.yml`

```yaml
name: Weekly Rebalance Check
on:
  schedule:
    - cron: '0 3 * * 1'   # 08:30 IST Monday
  workflow_dispatch:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: backend
      - run: npm run check:weekly
        working-directory: backend
        env:
          JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
          JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
          JIRA_PROJECT_KEY: ${{ secrets.JIRA_PROJECT_KEY }}
          NIM_API_KEY: ${{ secrets.NIM_API_KEY }}
          NIM_REBALANCE_MODEL: nvidia/nemotron-3.5-lightning-30b-a3b
          NIM_REBALANCE_MODEL_FALLBACK: deepseek-ai/deepseek-v4.1-flash
```

**After creating files**: add secrets in GitHub → Settings → Secrets and variables → Actions:  
`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`, `NIM_API_KEY`

---

## Gemini Pro — Frontend, UI, Deployment

**Rationale**: Gemini handles everything UI-facing and deployment config — React components, CSS, deploy steps — where iteration speed matters more than deep system knowledge.

---

### G1 — FR7 Plan Chat Frontend (Phase 4b frontend)

**Dependencies**: Bob's B2 must be merged first (needs the `/api/plan/chat` and `/api/plan/apply` routes to exist).

**`frontend/src/App.jsx`**: add `'Plan'` to `const TABS = ['Today', 'Board', 'Progress', 'Plan']`.

**`frontend/src/api.js`**: add two functions:
```js
export const planChat = (messages) =>
  fetch(`${API}/plan/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }) }).then(r => r.json());

export const planApply = (config) =>
  fetch(`${API}/plan/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) }).then(r => r.json());
```

**Create `frontend/src/views/PlanView.jsx`**: See `plan.md §Phase 4b Frontend` for the full UI layout spec. Key behaviour:
- Message history scrolls, newest at bottom.
- If `proposedConfig` in response: show a fenced JSON preview block + **Apply Changes** / **Discard** buttons.
- On Apply: `planApply(pendingConfig)` → show a green "✓ Config saved" toast for 3s.
- `sending` state disables the Send button and shows a spinner.

---

### G2 — Rebalance Suggestion Card (Phase 4c frontend)

**Dependencies**: Bob's B3 must be merged first.

**`frontend/src/api.js`**: add:
```js
export const getLatestRebalance = () => fetch(`${API}/rebalance/latest`).then(r => r.json());
export const approveRebalance = () => fetch(`${API}/rebalance/approve`, { method: 'POST' }).then(r => r.json());
```

**Create `frontend/src/views/RebalanceCard.jsx`**:
- `useEffect` on mount: call `getLatestRebalance()`. If `null`, render nothing.
- If suggestion present: render an amber banner above the todo list with:
  - Week number + date
  - Each option as a bullet: `{track}: {change}` — `{rationale}`
  - **✓ Approve** button (calls `approveRebalance`, hides card on success)
  - **✗ Dismiss** button (hides card locally, doesn't approve)

**`frontend/src/views/TodayView.jsx`**: import `RebalanceCard` and render `<RebalanceCard />` as the first child inside the outer `<div>`.

---

### G3 — All-Track Progress + Streak (Phase 4d frontend)

**Dependencies**: Bob's B4 must be merged first.

**`frontend/src/views/ProgressView.jsx`**:
- Add streak badge at the top: `🔥 {data.streak}-day streak` (show "No streak yet" if `streak === 0`).
- Add a "Current Quarter Tracks" section below the DSA step bars:
  - One row per track from `data.tracks`: track name, weekly hours target, `focus` text (greyed out, smaller), and a status pill (`on-pace` → green, `behind` → red, `ahead` → blue).

---

### G4 — UI Polish (Phase 5a)

This task has no backend dependency — can start immediately.

**`frontend/index.html`**: add inside `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**`frontend/src/index.css`**: set base font:
```css
body { font-family: 'Inter', system-ui, sans-serif; }
```

**`frontend/src/App.css`** — redesign with:
- **Glassmorphism cards**: `background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;`
- **Gradient accent** on active tab underline + done/approve buttons: `linear-gradient(135deg, #6366f1, #8b5cf6)`
- **Animated progress bars**: `@keyframes progressFill { from { width: 0 } to { width: var(--target) } }` — apply on mount via CSS var set inline
- **Loading skeletons**: replace plain `<p>Loading...</p>` with shimmer blocks — `background: linear-gradient(90deg, #1f1f23, #2a2a2e, #1f1f23); background-size: 200%; animation: shimmer 1.5s infinite;`
- **Card hover lift**: `.todo-item:hover, .board-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.15); transition: all 0.15s ease; }`
- **Track badge colours**: `track-dsa`→`#6366f1`, `track-project`→`#10b981`, `track-cloudcert`→`#0ea5e9`, `track-opensource`→`#f59e0b`, `track-fundamentals`→`#f43f5e`
- **Fix**: remove the empty `<h3></h3>` in `BoardView.jsx`

---

### G5 — Deploy: Frontend to Vercel (Phase 5d)

**Dependencies**: G4 (UI polish) should be done before taking the screenshot.

```powershell
cd frontend
npm run build          # verify build passes locally first
npx vercel login
npx vercel --prod
```

In Vercel dashboard → Project Settings → Environment Variables:
- `VITE_API_URL` = `https://<render-service-url>/api`

---

### G6 — Deploy: Backend to Render (Phase 5d)

**Dependencies**: Bob's B5 (SQLite) should be complete.

1. Go to [dashboard.render.com](https://dashboard.render.com) → New → Web Service.
2. Connect GitHub repo. Set Root Directory: `backend`, Build: `npm install`, Start: `npm start`, Node: 20.
3. Add env vars:
   - `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`
   - `NIM_API_KEY`
   - `NIM_REBALANCE_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b`
   - `NIM_REBALANCE_MODEL_FALLBACK=deepseek-ai/deepseek-v4.1-flash`
   - `NIM_CHAT_MODEL=nvidia/nemotron-3-ultra-550b-a55b`
   - `NIM_CHAT_MODEL_FALLBACK=nvidia/nemotron-3-super-120b-a12b`
   - `PORT=4000`
4. After deploy URL is live: update `VITE_API_URL` in Vercel and redeploy frontend (G5 step).
5. Set up [UptimeRobot](https://uptimerobot.com) HTTP monitor on `https://<render-url>/api/health` every 5 min.

---

### G7 — README Screenshot + Diagram Check (Phase 5e)

1. Paste the Mermaid diagram from `README.md` into [mermaid.live](https://mermaid.live) — verify it renders without errors.
2. Take a screenshot of the deployed dashboard (Today tab visible).
3. Save as `docs/dashboard-screenshot.png` (create `docs/` directory if needed).
4. Add to `README.md` below the Mermaid diagram:
   ```markdown
   ![Dashboard](./docs/dashboard-screenshot.png)
   ```

---

## Task Order & Dependencies

```
Bob:    B1 → B2 → B3 → B4 → B5 → B6
Gemini: G4 (no deps, start now) → G1 (after B2) → G2 (after B3) → G3 (after B4) → G5 → G6 (after B5) → G7
```

```
B1 ──────────────────────────────────── blocks B2, B3, B4
B2 ──── G1 (frontend shell)
B3 ──── G2 (rebalance card)
B4 ──── G3 (progress view)
B5 ──── G6 (Render deploy)
G4 ──── G5 (Vercel deploy, after polish)
G5+G6 ─ G7 (screenshot after both deployed)
```

---

## Summary Table

| ID | Agent | Phase | Task | Critical Path |
|---|---|---|---|---|
| B1 | Bob | 4a | Fix NIM rebalancer (model swap, prompt fix, env var rename, tests) | ⚠️ Blocks all |
| B2 | Bob | 4b | `/api/plan/chat` + `/api/plan/apply` backend routes | Blocks G1 |
| B3 | Bob | 4c | Rebalance routes + `latest-rebalance.json` persistence | Blocks G2 |
| B4 | Bob | 4d | Extend `/api/progress` — active tracks + streak (Jira query) | Blocks G3 |
| B5 | Bob | 5b | SQLite store (`db/index.js`, schema, integration) | Blocks G6 |
| B6 | Bob | 5c | GitHub Actions CI/CD (daily + weekly cron workflows) | Independent |
| G4 | Gemini | 5a | UI polish (Inter font, glassmorphism, animations, skeletons) | Independent |
| G1 | Gemini | 4b | `PlanView.jsx` chat UI + `App.jsx` Plan tab | After B2 |
| G2 | Gemini | 4c | `RebalanceCard.jsx` + wire into `TodayView.jsx` | After B3 |
| G3 | Gemini | 4d | `ProgressView.jsx` — streak badge + all-track rows | After B4 |
| G5 | Gemini | 5d | Deploy frontend to Vercel | After G4 |
| G6 | Gemini | 5d | Deploy backend to Render + UptimeRobot | After B5 |
| G7 | Gemini | 5e | README screenshot + Mermaid diagram verification | After G5+G6 |
