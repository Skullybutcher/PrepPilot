# PrepPilot — Implementation Plan

> **Created**: 2026-10-02  
> **Estimated total**: ~3h 45min of focused work  
> **Goal**: Fix NIM, implement FR7 plan chat, polish UI, deploy to Vercel + Render, wire GitHub Actions CI

---

## Key Decisions (resolved — see SPEC.md §6 + §10)

| Decision | Choice | Reason |
|---|---|---|
| FR6 model (rebalancer) | `nvidia/nemotron-3.5-lightning-30b-a3b` | **Confirmed free endpoint.** Fastest 30B A3B MoE, purpose-built for specialized agentic tasks. ⚠️ NOT the old `nemotron-3-nano-30b-a3b` that returned empty options. Fallback: `deepseek-ai/deepseek-v4.1-flash`. |
| FR7 model (plan chat) | `nvidia/nemotron-3-ultra-550b-a55b` | **Confirmed free endpoint.** 1M context window — zero overflow risk. Explicitly strong at agentic reasoning + planning. Fallback: `nvidia/nemotron-3-super-120b-a12b` (also 1M ctx). |
| Frontend hosting | Vercel Hobby | Free, no cold-start for static sites, zero-config Vite deploy |
| Backend hosting | Render free tier | 750 hrs/month; UptimeRobot ping on `/api/health` prevents sleep |
| Data store | SQLite (`better-sqlite3`) | Phase 5 only; persists `WeeklyCheckIn` + `RebalanceSuggestion` history |
| NIM API key | Same single key for FR6 + FR7 | Both models on same `integrate.api.nvidia.com` endpoint |
| Current `.env` `NIM_MODEL` | `nvidia/nemotron-3-nano-30b-a3b` | User's current `.env` setting. Known to fail — apply prompt fix first, then swap to Lightning if still broken. |

---

## Phase 4a — Fix NIM Rebalancer (~45 min)

**Goal**: `npm run check:weekly` produces non-empty options via a live NIM call.

### Pre-check before touching code

Confirm `llama-3.2-90b-vision-instruct` is available on your NIM account (already confirmed via catalog search).
Also check your full NIM catalog without any filter — there may be non-Llama models (Mistral, DeepSeek, Qwen) with better JSON instruction following.

Minimal pre-code test for FR6:
```powershell
$env:NIM_API_KEY='<your-key>'
$env:NIM_MODEL='nvidia/nemotron-3.5-lightning-30b-a3b'
node backend/.tmp-run5.mjs
```
Expected: non-empty `options` array with `track`, `change`, `rationale` keys.

> ⚠️ `nemotron-3.5-lightning-30b-a3b` ≠ `nemotron-3-nano-30b-a3b` — different models. Lightning is newer, agentic-specialized.

**If testing Nano first** (current `.env`): apply prompt fix (step 3 below) before live test. Switch to Lightning immediately if still `{"options":[]}`.

### Task list

**File: `backend/src/generator/rebalanceSuggestion.js`**

- [ ] **Remove env mutation**: delete `process.env.NIM_MODEL = modelId.trim()` inside the model loop.
- [ ] **Pass model explicitly**: update `callWithBackoff(messages, model)` signature; pass `model` to `chat({ messages, model, responseFormat, temperature, maxTokens })`.
- [ ] **Remove empty-options escape hatch** from `SYSTEM_PROMPT`: delete `"If there are no triggers, return exactly {\"options\": []}."` — the function only runs when `triggered: true`, so an empty list is always wrong.
- [ ] **Shorten system prompt**: keep contract + rules. Remove the inline few-shot `role:'user'`/`role:'assistant'` from the `messages` array — suspected cause of model confusion.
- [ ] **Extract `logFailure(entry)` helper**: consolidate the 3 duplicated `fs.appendFileSync` blocks into one top-level function.
- [ ] **Lift `generateDeterministic`** to module scope (currently defined inside the exported function body — invisible to tests).

**File: `backend/.env.example`**

- [ ] Change `NIM_MODEL=mistralai/mistral-nemotron` → `NIM_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b`
- [ ] Add `NIM_MODEL_FALLBACK=deepseek-ai/deepseek-v4.1-flash`
- [ ] Add `NIM_MODEL_FR7=nvidia/nemotron-3-ultra-550b-a55b`

**File: `backend/src/generator/rebalanceSuggestion.test.js`**

- [ ] Add: valid first response → returns expected options (injected `chat` stub).
- [ ] Add: empty first response → corrective retry → valid response.
- [ ] Add: transient `ECONNRESET` on first attempt → backoff → success on second.
- [ ] Add: all models return empty → throws `"All candidate NIM models failed"`.

**Validate**:
```powershell
npm --prefix backend test
# Primary model:
$env:NIM_MODEL='nvidia/nemotron-3.5-lightning-30b-a3b'; npm --prefix backend run check:weekly
# If above fails, fallback:
$env:NIM_MODEL='deepseek-ai/deepseek-v4.1-flash'; npm --prefix backend run check:weekly
```

---

## Phase 4b — FR7 Conversational Plan Builder (~60 min)

**Goal**: Dashboard "Plan" tab where you chat to create or revise the roadmap. Bot proposes a diff; you approve before it writes.

### Architecture constraints (from SPEC FR7)
- **No RAG** — full `roadmap.config.json` + Striver progress summary (done/total per step) pasted into system prompt each turn.
- **No cross-session memory** — message array passed client → server each turn. Browser refresh loses in-progress conversation (acceptable v1 tradeoff).
- **Approve-before-write** — bot proposes a config diff via a fenced JSON block; a separate "Apply Changes" button calls `POST /api/plan/apply` to write to disk.

### Backend

**New file: `backend/src/routes/plan.js`**

```
POST /api/plan/chat
Body:  { messages: [{role: string, content: string}][] }
Returns: { reply: string, proposedConfig?: object }
```

Logic:
1. Load `backend/src/config/roadmap.config.json`.
2. Load `backend/src/data/striver-a2z.json`, compute per-step done/total summary.
3. Build system prompt: role description + full config JSON + striver summary.
4. Append user messages array, call `nimChat` with `model: process.env.NIM_MODEL_FR7 || 'nvidia/nemotron-3-ultra-550b-a55b'`, `maxTokens: 4096` (no `responseFormat: 'json_object'` — this is free text).
5. If reply contains a ` ```json ... ``` ` block, extract and parse it as `proposedConfig`.
6. Return `{ reply, proposedConfig }`.

```
POST /api/plan/apply
Body:  { config: RoadmapConfig }
Returns: { ok: true }
```

Logic:
1. Validate incoming config: must have `startDate` (string), `quarters` (array), `recoveryWeekEveryNWeeks` (number).
2. Write atomically: `JSON.stringify(config, null, 2)` → `roadmap.config.json.tmp` → rename to `roadmap.config.json`.
3. Return `{ ok: true }`.

**`backend/src/server.js`**: mount `import planRouter from './routes/plan.js'` → `app.use('/api/plan', planRouter)`.

### Frontend

**`frontend/src/App.jsx`**: add `'Plan'` to `const TABS = ['Today', 'Board', 'Progress', 'Plan']`.

**New file: `frontend/src/views/PlanView.jsx`**

State: `messages[]`, `pendingConfig`, `sending`, `input`.

UI:
```
┌─────────────────────────────────────┐
│  Plan Builder                       │
│  Paste roadmap or describe changes  │
├─────────────────────────────────────┤
│  [scrollable message history]       │
│  user: ...                          │
│  assistant: ...                     │
│  [proposed config JSON block]       │
│  [✓ Apply]  [✗ Discard]            │
├─────────────────────────────────────┤
│  [text input               ] [Send] │
└─────────────────────────────────────┘
```

On Send: append user message → `POST /api/plan/chat` → append reply → set `pendingConfig` if present.  
On Apply: `POST /api/plan/apply` → clear `pendingConfig` → show success toast.

**`frontend/src/api.js`**: add
```js
export const planChat = (messages) => post('/plan/chat', { messages });
export const planApply = (config) => post('/plan/apply', { config });
```

---

## Phase 4c — Rebalance Suggestion Card (~30 min)

**Goal**: When a `RebalanceSuggestion` from the weekly check exists, it shows as an approve/reject banner on the Today tab.

### Interim file-based approach (SQLite comes in Phase 5)

**`backend/src/scripts/weeklyRebalanceCheck.js`**:
- [ ] After `generateRebalanceSuggestion`, write result to `backend/src/data/latest-rebalance.json`.

**New file: `backend/src/routes/rebalance.js`**:

```
GET  /api/rebalance/latest    → reads latest-rebalance.json; returns null if missing or approved
POST /api/rebalance/approve   → sets approved:true in the JSON file; optionally logs the change text
```

**`backend/src/server.js`**: mount `rebalanceRouter` at `/api/rebalance`.

**`frontend/src/api.js`**: add `getLatestRebalance()` and `approveRebalance()`.

**New file: `frontend/src/views/RebalanceCard.jsx`**:
- Fetches `/api/rebalance/latest` on mount.
- If suggestion exists + not approved: renders amber banner with options, Approve + Dismiss buttons.
- On Approve: calls `POST /api/rebalance/approve`, hides card.

**`frontend/src/views/TodayView.jsx`**: import and render `<RebalanceCard />` above the todo list.

---

## Phase 4d — All-Track Progress + Streak (~20 min)

**Goal**: ProgressView shows all 5 active tracks with hours context, plus a streak counter.

**`backend/src/routes/progress.js`**:
- [ ] Determine current quarter from `roadmap.config.json` `startDate` + current date.
- [ ] Return `tracks: [{ name, weeklyHours, focus }]` for the active quarter's tracks.
- [ ] Return `streak: N` — count of consecutive days (from today backward) where at least one Jira subtask was transitioned to Done. Use Jira search: `issuetype = Subtask AND status = Done AND updated >= -14d ORDER BY updated DESC`, then count distinct calendar dates up to first gap.

**`frontend/src/views/ProgressView.jsx`**:
- [ ] Add streak badge at top: `🔥 {data.streak}-day streak` (or "No streak yet" if 0).
- [ ] Add "Current Quarter Tracks" section: one row per track showing name, weekly hours target, and focus text.

---

## Phase 5 — Polish, SQLite, CI/CD, Deploy (~65 min)

### 5a — UI Polish (~20 min)

**`frontend/index.html`**: add Inter font:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**`frontend/src/index.css`**: set `font-family: 'Inter', system-ui, sans-serif`.

**`frontend/src/App.css`** — key additions:
- Glassmorphism cards: `background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08);`
- Gradient accent on active tab + done button: `background: linear-gradient(135deg, #6366f1, #8b5cf6)`
- Animated progress bars: keyframe from `width: 0` to actual value on mount
- Loading skeletons: replace `<p>Loading...</p>` with shimmer `<div class="skeleton">`
- Card hover lift: `transition: transform 0.15s, box-shadow 0.15s;` + `:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.2); }`
- Track badge color map: `track-dsa`→indigo, `track-project`→emerald, `track-cloudcert`→sky, `track-opensource`→amber, `track-fundamentals`→rose

### 5b — SQLite (~15 min)

```powershell
npm --prefix backend install better-sqlite3
```

**New file: `backend/src/db/index.js`**:
```js
// Opens DB at process.env.DB_PATH || './data/roadmap.db'
// Creates tables if not exist:
// weekly_checkins(id, date, week_number, payload TEXT, triggered INTEGER)
// rebalance_suggestions(id, date, week_number, options TEXT, approved INTEGER)
export function getDb() { ... }
export function insertCheckIn(checkIn) { ... }
export function insertSuggestion(suggestion) { ... }
export function getLatestSuggestion() { ... }
export function approveSuggestion(id) { ... }
```

**`backend/src/scripts/weeklyRebalanceCheck.js`**: import `getDb`, call `insertCheckIn` and `insertSuggestion`.  
**`backend/src/routes/rebalance.js`**: prefer `getLatestSuggestion()` from DB, fall back to JSON file.

### 5c — GitHub Actions (~10 min)

**`.github/workflows/daily-todos.yml`**:
```yaml
name: Daily Todo Generation
on:
  schedule:
    - cron: '0 1 * * *'   # 6:30 AM IST
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

**`.github/workflows/weekly-rebalance.yml`**:
```yaml
name: Weekly Rebalance Check
on:
  schedule:
    - cron: '0 3 * * 1'   # 8:30 AM IST on Mondays
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
          NIM_MODEL: nvidia/nemotron-3.5-lightning-30b-a3b
```

Add these secrets in **GitHub → Settings → Secrets and variables → Actions**:
`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`, `NIM_API_KEY`

### 5d — Deploy (~20 min)

#### Frontend → Vercel
```powershell
cd frontend
npm run build          # verify locally first
npx vercel login
npx vercel --prod
```
In Vercel dashboard → Project Settings → Environment Variables:
- `VITE_API_URL` = `https://<your-render-service>.onrender.com/api`

#### Backend → Render
1. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Web Service**
2. Connect GitHub repo; set:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Node version: `20`
3. Add env vars: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`, `NIM_API_KEY`, `NIM_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b`, `NIM_MODEL_FR7=nvidia/nemotron-3-ultra-550b-a55b`, `PORT=4000`
4. After deploy, set up **UptimeRobot** HTTP monitor on `https://<render-url>/api/health` every 5 min

After Render URL is live: update `VITE_API_URL` in Vercel and redeploy frontend.

### 5e — README screenshot (~5 min)
- Paste the Mermaid diagram from `README.md` into [mermaid.live](https://mermaid.live) to verify it renders.
- Take screenshot of the deployed dashboard, save as `docs/dashboard-screenshot.png`.
- Add to README: `![Dashboard](./docs/dashboard-screenshot.png)`

---

## Commit Sequence

```
fix: swap NIM model to llama-4-scout, pass model explicitly, remove env mutation
fix: remove empty-options escape hatch from rebalancer system prompt
refactor: extract logFailure helper, lift generateDeterministic to module scope
test: injected-client tests for rebalanceSuggestion (empty→corrective, backoff, all-fail)
feat(4b): add POST /api/plan/chat and POST /api/plan/apply (FR7 backend)
feat(4b): add Plan tab with PlanView.jsx — chat UI with approve-before-write
feat(4c): add rebalance routes (latest, approve) and latest-rebalance.json persistence
feat(4c): add RebalanceCard component to TodayView
feat(4d): extend /api/progress with active tracks + streak; update ProgressView
style: redesign dashboard — Inter font, glassmorphism, gradient accents, animated progress bars
feat(5b): add SQLite store for WeeklyCheckIn and RebalanceSuggestion history
ci: add GitHub Actions for daily todo cron and weekly rebalance cron
deploy: frontend to Vercel, backend to Render
docs: Mermaid architecture diagram verified; add dashboard screenshot to README
```

---

## All Files to Create / Modify

| File | Action |
|---|---|
| `backend/src/generator/rebalanceSuggestion.js` | Modify — model swap, remove env mutation, fix prompt, extract helpers |
| `backend/src/generator/rebalanceSuggestion.test.js` | Modify — add 4 injected-client test cases |
| `backend/.env.example` | Modify — update `NIM_MODEL`, add `NIM_MODEL_FR7` |
| `backend/src/routes/plan.js` | **Create** — `POST /api/plan/chat` + `POST /api/plan/apply` |
| `backend/src/routes/rebalance.js` | **Create** — `GET /api/rebalance/latest` + `POST /api/rebalance/approve` |
| `backend/src/scripts/weeklyRebalanceCheck.js` | Modify — write `latest-rebalance.json` after suggestion |
| `backend/src/db/index.js` | **Create** (Phase 5b) — SQLite setup + schema |
| `backend/src/server.js` | Modify — mount `planRouter` and `rebalanceRouter` |
| `frontend/src/App.jsx` | Modify — add `'Plan'` tab |
| `frontend/src/api.js` | Modify — add `planChat`, `planApply`, `getLatestRebalance`, `approveRebalance` |
| `frontend/src/views/PlanView.jsx` | **Create** — chat UI component |
| `frontend/src/views/RebalanceCard.jsx` | **Create** — suggestion approve/reject banner |
| `frontend/src/views/TodayView.jsx` | Modify — render `<RebalanceCard />` |
| `frontend/src/views/ProgressView.jsx` | Modify — all-track rows + streak badge |
| `frontend/index.html` | Modify — add Inter font CDN link |
| `frontend/src/App.css` | Modify — glassmorphism redesign |
| `frontend/src/index.css` | Modify — global font + CSS custom properties |
| `.github/workflows/daily-todos.yml` | **Create** |
| `.github/workflows/weekly-rebalance.yml` | **Create** |

---

## Time Budget Summary

| Phase | Task | Est. |
|---|---|---|
| 4a | Fix NIM rebalancer (code + tests) | 45 min |
| 4b | FR7 plan chat (backend + frontend) | 60 min |
| 4c | Rebalance suggestion card | 30 min |
| 4d | All-track progress + streak | 20 min |
| 5a | UI polish | 20 min |
| 5b | SQLite store | 15 min |
| 5c | GitHub Actions | 10 min |
| 5d | Deploy (Vercel + Render) | 20 min |
| 5e | Screenshot + diagram check | 5 min |
| **Total** | | **~3h 45min** |

---

> The `dashboard/` directory at repo root is empty and unused. Delete it or repurpose later for generated reports — not blocking anything now.
