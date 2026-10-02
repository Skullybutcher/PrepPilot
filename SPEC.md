# Placement Prep Copilot — Project Specification

## 1. Overview

**What this is**: A self-hosted system that turns a 12-month placement preparation roadmap into daily, adaptive todos. It tracks progress on Jira, generates each day's tasks based on actual pace (not a fixed calendar), and surfaces everything on a personal dashboard.

**What this is not**: A generic todo app. The differentiator is that it reasons about *your specific plan* — DSA progress against Striver's A2Z sheet, project/cert/open-source pacing against a quarterly roadmap — and adjusts recommendations weekly.

**Why it matters as a project**: This is also Project 1 in the roadmap. It should be built to the same standard expected of a placement-portfolio project — clean architecture, tests, CI/CD, a real README, and a public GitHub history showing incremental commits over time (not one giant initial commit).

---

## 2. Goals & Non-Goals

**Goals**
- Generate a daily todo list (3-5 tasks) based on roadmap position + actual Jira velocity
- Sync todos as Jira subtasks so Jira remains the system of record
- Track DSA progress against Striver's A2Z sheet specifically (step-by-step, problem-by-problem)
- Detect when a track is falling behind pace and suggest rebalancing (not silently reshuffle)
- Present all of this on a single dashboard — today's todos front and center, progress views secondary

**Non-Goals (at least for v1)**
- No mobile app — a responsive web dashboard is enough
- No multi-user support — this is a single-user tool
- No fully autonomous replanning — the agent *suggests*, you approve. It should never silently rewrite the roadmap.
- No real-time sync — daily batch runs are sufficient; this isn't a chat-ops tool

---

## 3. Functional Requirements

### FR1 — Roadmap Config
- The 12-month plan (quarters, tracks, weekly rhythm, recovery-week cadence) is stored as structured config (YAML/JSON), not hardcoded in logic. You should be able to edit the plan without touching code.
- Config includes: quarter start/end dates, active tracks per quarter, weekly hour budget, recovery week frequency.

### FR2 — Striver A2Z Sheet Tracking
- The full sheet (steps → sub-steps → problems, in order) stored as structured data (JSON).
- System tracks: which problems are done, when, and (optionally) time-to-solve / attempt count for weak-topic detection.
- Must preserve official sheet ordering — the agent should never suggest skipping ahead out of order without you explicitly marking a topic "skip."

### FR3 — Jira Integration
- **Read**: pull current board state, issue status, worklogs/velocity via Jira REST API.
- **Write**: create/update daily subtasks under the relevant epic (mapped to quarter) and label (mapped to track: `DSA`, `Project`, `CloudCert`, `OpenSource`, `Fundamentals`).
- Jira project structure: Epics = quarters, Stories = weekly goals per track, Subtasks = daily todos.
- Must be idempotent — running the daily generator twice in a day shouldn't create duplicate subtasks.

### FR4 — Daily Todo Generator
- Runs once per day (scheduled, e.g. via cron or GitHub Actions on a schedule).
- Inputs: roadmap config, Striver sheet progress, Jira velocity (last 2-4 weeks), day type (weekday/Sat/Sun), recovery-week flag.
- Output: 3-5 concrete, specifically-named tasks (not "do DSA" — actual problem names, actual topic names) sized to the day's hour budget.
- Writes output both to Jira (as subtasks) and to a `daily_todos` table the dashboard reads.

### FR5 — Progress Tracking & Dashboard
- Dashboard home page: today's todos, checkable, synced back to Jira on check-off.
- Progress views: DSA sheet completion %, project completion, cert/open-source status, hours logged vs. planned per track, streak.
- Can be a standalone dashboard with an embedded Jira board view, or a fully custom UI reading Jira via API — your call (see Section 6).

### FR6 — Rebalancing Agent
- Runs weekly (not daily — avoid single-bad-day panic triggers).
- Compares actual pace per track against the pace required to hit quarterly milestones.
- Triggers a suggestion if **either** of two conditions is true (combined trigger — either one alone is sufficient, they're independent signals):
  - **Off-pace**: a track is behind the pace required to hit quarterly milestones for **2+ consecutive weekly check-ins**, based on completion rate (DSA problems / hours vs. what the plan requires at this point in the quarter).
  - **Stale**: an individual Jira card has sat in "To Do" or "In Progress" without a status change for **2+ weeks**, regardless of whether the track it belongs to is otherwise on pace. Detected via the Jira changelog API (actual last status-transition date), not the `updated` field — `updated` changes on any edit (comment, label, description), not just status changes, so it's too noisy to use directly.
  - These are deliberately separate checks: a track can be perfectly on-pace overall while one specific card rots for two weeks, or vice versa. Either condition alone is enough to fire the suggestion.
- The model's input is a pre-computed, structured payload built by application code — a `WeeklyCheckIn`-shaped object with per-track pace deltas and the consecutive-behind counter, plus which stale cards (if any) triggered the check. The model never sees raw Jira data or the roadmap config directly.
- The model's job is narrow: given that structured input, produce 1-2 concrete rebalancing **options** — not a rewritten plan, not encouragement, not an explanation of *why* the person is behind. By the time the model is called, "should we suggest something" has already been decided by the trigger logic above; the model only decides *what* the suggestion says.
- Output is strict JSON matching `RebalanceSuggestion` (Section 7) — structured, not free text, since the dashboard renders it as a card the person approves or rejects. Not an automatic plan rewrite; approved changes update the config.
- Uses an LLM call (NVIDIA NIM — free-tier model, TBD which one) with the structured pace data as context — not a free-form "how am I doing" prompt. Keep the input structured so output stays specific and actionable.

### FR7 — Conversational Plan Builder
- An ongoing (not one-time-onboarding) chat interface for creating or revising the roadmap: the person can dump an unstructured brain-dump of tasks, or paste in an existing roadmap they already have, and have a conversation that produces a structured `RoadmapConfig` (FR1).
- **Lives as a "Plan" tab** in the dashboard, alongside Today/Board/Progress — not a CLI script, since conversations don't fit a CLI back-and-forth well and a CLI would lose chat history between runs. Same architecture pattern as the rest of the system: frontend never talks to the LLM directly, everything goes through the Express API layer.
  - Backend: a `POST /api/plan/chat` endpoint that holds (or receives each turn) the conversation, calls NIM, and on confirmation writes to `roadmap.config.json`.
- **Document ingestion — no RAG.** A roadmap document or brain-dump is realistically a few hundred to a few thousand words, which fits entirely inside a single prompt. The whole document is pasted directly into the prompt as context each turn — no chunking, embeddings, or vector DB. RAG would be actively worse here: retrieval could miss cross-references between sections of a small document, where "give the model everything" has no such failure mode. Before picking a NIM model for this, confirm its context window comfortably covers system prompt + existing roadmap doc + Striver progress summary + full conversation so far.
- **Memory — in-session only, no cross-session memory store.**
  - In-session: standard chat, pass the message array back each turn.
  - Cross-session: deliberately **not** implemented. Each new plan conversation re-grounds itself from the current `roadmap.config.json` + Striver progress, rather than recalling old chat transcripts. This keeps a single system of record (the actual config file) instead of two things that could drift apart (the file, and whatever the model half-remembers). The only gap this leaves is losing an in-progress, unconfirmed conversation on a browser refresh — an acceptable v1 tradeoff, and fixable later (persist the current message array) if it ever becomes a real problem.
- **Approve-before-write**, same principle as FR6's rebalancing agent: the bot proposes a `RoadmapConfig` diff/preview and only writes to `roadmap.config.json` on explicit confirmation. Never silently overwrites the plan.
- Relationship to FR6: the two features are related but distinct entry points. FR6's rebalancing agent is a small, structured nudge ("here's what's behind, here are 1-2 tweak options") feeding `WeeklyCheckIn` / `RebalanceSuggestion`. FR7's chatbot is the bigger surface for either starting a plan from scratch or restructuring an existing one — a natural place to land when a rebalancing suggestion gets rejected or the person wants something more involved than a 1-2 option tweak ("open this in the plan chat instead").

---

## 4. Non-Functional Requirements

- **Security**: Jira API tokens and Claude API keys stored as environment variables / secrets, never committed to GitHub. Use a `.env.example` file in the repo, real `.env` gitignored.
- **Cost**: Weekly LLM calls only (not daily), and using a free-tier NVIDIA NIM model rather than a paid API, keeps this at effectively zero ongoing cost. Daily todo generation is pure logic — no LLM call needed for that part.
- **Reliability**: If the daily generator fails (Jira API down, etc.), it should fail loudly (log/notify) rather than silently produce no todos.
- **Maintainability**: Since this is a portfolio project too, structure it as you would any placement project — clear module boundaries, tests for the core logic (todo generation, pace calculation), a real README with architecture diagram.

---

## 5. Architecture (as built)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Roadmap Config   │     │  Striver A2Z Data  │     │  Jira Cloud  │
│  (YAML/JSON)       │     │  (JSON, 18 steps,  │     │  (via REST)  │
│                     │     │   474 problems)     │     │              │
└────────┬─────────┘     └────────┬──────────┘     └──────┬──────┘
         │                        │                        │
         └────────────┬───────────┴────────────┬───────────┘
                       ▼                        │
              ┌─────────────────┐               │
              │ Daily Generator  │──── writes ──▶│ (Jira subtasks)
              │  (scheduled job) │               │
              └─────────────────┘               │
                                                   │
                       ┌───────────────────────────┘
                       ▼
              ┌─────────────────────┐
              │  Express API layer   │   backend/src/routes/
              │  /api/todos/today     │   (todos, board, progress)
              │  /api/board            │
              │  /api/progress         │
              └──────────┬───────────┘
                          │ fetch, via VITE_API_URL
                          ▼
              ┌─────────────────────┐
              │  React Dashboard      │   frontend/ (Vite)
              │  Today / Board /       │
              │  Progress tabs          │
              └─────────────────────┘

                       ▲
                       │ weekly (Phase 4, not yet built)
              ┌─────────────────┐
              │ Rebalancing Agent │──▶ NVIDIA NIM (structured prompt)
              │  (scheduled job)   │
              └─────────────────┘
```

The dashboard never talks to Jira directly — every read goes through the
Express API layer, which is the only place the Jira token lives. This was
the resolution to Open Decision #2 below: not a Jira board embed, but a
fully custom UI reading through the backend.

---

## 6. Suggested Tech Stack (adjust to what you're comfortable with — this is also a learning project)

| Layer | Decision | Why |
|---|---|---|
| Backend/API | Node.js (Express) — **built** | Software Engineering track reps; clean module boundary between Jira and dashboard |
| Scheduled jobs | **GitHub Actions** (cron schedule) — **Phase 5** | Free, versioned, commit-visible in GitHub activity graph (recruiter-facing) |
| Data store | **SQLite** (`better-sqlite3`) — **Phase 5** | Lightweight; needed to persist `WeeklyCheckIn` + `RebalanceSuggestion` history that has no natural home in Jira. `DB_PATH=./data/roadmap.db` already in `.env.example`. |
| Dashboard | React (Vite) — **built** | Matches frontend conventions; deployable on Vercel free tier |
| Jira integration | Jira REST API v3, raw fetch — **built** | Straightforward, well-documented |
| LLM — FR6 (rebalancing) | **NVIDIA NIM `nvidia/nemotron-3.5-lightning-30b-a3b`** (free tier) | Fastest 30B A3B MoE, purpose-built for specialized agentic tasks with leading domain accuracy. Perfect for the narrow structured call (WeeklyCheckIn → 1-2 JSON options). **Different model from the old `nemotron-3-nano-30b-a3b`** which failed. Fallback: `deepseek-ai/deepseek-v4.1-flash` (8B active params, fast instruction-following). |
| LLM — FR7 (plan chat) | **NVIDIA NIM `nvidia/nemotron-3-ultra-550b-a55b`** (free tier) | 1M context window, explicitly strong at agentic reasoning, coding, and **planning** — exactly the FR7 use case. Zero risk of context overflow even with full `roadmap.config.json` + Striver progress + a long conversation. Same NIM API key, no second provider. |
| Frontend hosting | **Vercel** (Hobby plan) | Free: 100 GB bandwidth, 1M function invocations, no sleep/cold-start for static sites. Zero config for Vite projects (`vite build` → deploy). |
| Backend hosting | **Render** (free tier) | Free: 750 instance hours/month (enough for 24/7 with one service). Does sleep after 15 min inactivity — mitigated by a UptimeRobot ping on `/api/health` every 10 min. Better than Railway's $1/mo credit cap for a low-traffic personal tool. |
| Backend `package.json` | Add `"syncStriver": "node src/scripts/syncStriverToJira.js"` — currently missing | `sync:striver` script referenced in README is not in package.json |

---

## 7. Data Models (core entities)

- **RoadmapConfig**: quarter list, per-quarter active tracks, hour budgets, recovery week cadence
- **StriverProblem**: id, step, sub-step, name, difficulty, status (todo/done/skipped), date_completed, attempts
- **Track**: name, weekly target hours, cumulative hours logged, status (on-pace/behind/ahead)
- **DailyTodo**: date, task list (each with track label, Jira subtask ID, done status)
- **WeeklyCheckIn**: week number, per-track pace delta, consecutive-behind counter
- **RebalanceSuggestion**: `{ date, weekNumber, options: [{ track, change, rationale }] (1-2 entries), approved: bool }`. `options` comes verbatim from the NIM call (`generator/rebalanceSuggestion.js`); `date`/`weekNumber`/`approved` are set by application code, not the model.

---

## 8. Build Phases (matches the sequencing discussed earlier)

| Phase | Scope | Status |
|---|---|---|
| **Phase 0** | Jira project setup: epics, labels, manual story creation for Q1 | ✅ Done |
| **Phase 1** | Striver A2Z sheet as structured JSON + Jira sync script (read-only) | ✅ Done — full sheet, 18 steps / 474 problems, via Next.js flight-payload parsing |
| **Phase 2** | Daily todo generator (logic only, no LLM) + writes to Jira subtasks | ✅ Done |
| **Phase 3** | Dashboard v1: today's todos + basic progress views, reading from local DB/Jira | ✅ Done — Express API + React dashboard (Today / Board / Progress), reading live from Jira and the Striver JSON, no local DB needed yet. Extended with a done-button and drag-and-drop status changes (both optimistic-UI, updating instantly and rolling back only on failure), 30s auto-refresh polling, and server-side auto-transition of today's tasks from "To Do" to "In Progress" on first view each day |
| **Phase 4a** | Fix NIM rebalancing agent (FR6): swap model to `llama-4-scout`, refactor env mutation, fix system prompt, add corrective-retry tests | **In progress — blocked on NIM model reliability** — trigger logic and deterministic fallback work; NIM path broken (empty options / network failures with previous models). See `handover.md`. |
| **Phase 4b** | Conversational Plan Builder chat tab (FR7): `POST /api/plan/chat` + `PlanView.jsx` | **Not started** — backend route, frontend tab, and approve-before-write flow all pending. Model resolved: `llama-4-maverick` (512K ctx). |
| **Phase 4c** | RebalanceSuggestion card in dashboard: surface NIM suggestions as approve/reject card on Today view | **Not started** — no UI for the weekly suggestion output yet. |
| **Phase 4d** | All-track progress view + streak: show all 5 tracks (not just DSA) in ProgressView; add streak counter | **Not started** |
| **Phase 5** | SQLite store for WeeklyCheckIn/RebalanceSuggestion history; UI polish (fonts, animations, loading skeletons); tests; GitHub Actions CI (daily + weekly cron); deploy to Vercel + Render; README with Mermaid diagram + screenshot | **Not started** |

Total build time budget: **~2 weeks of focused work**, ideally absorbed into Month 1's project slot plus one recovery week — not carved out of DSA time.

---

## 9. GitHub Workflow

- Repo structure: `roadmap-copilot/` with `/backend`, `/frontend`, `/data` (Striver JSON, config), `/docs` (this spec + architecture diagram)
- Commit as you build each phase — real incremental history is part of the point (this is portfolio evidence of consistent work, which recruiters do look at)
- `README.md` at repo root: what it does, architecture diagram, setup
  instructions. A dashboard screenshot is deliberately deferred — the UI is
  still changing (drag-and-drop, optimistic updates, auto-transitions all
  landed recently), so a screenshot now would just go stale. Add it once
  Phase 5 stabilizes the UI.
- `.env.example` committed for both `/backend` and `/frontend`, real `.env` gitignored in both
- Once Phase 5 is done, this project itself becomes citable in your resume/interviews — worth writing a short design-decisions section (why Jira as system of record, why weekly not daily rebalancing, why the API layer sits between the dashboard and Jira) since interviewers often probe exactly these tradeoffs

---

## 10. Open Decisions

1. ~~Backend language: Node.js or Python?~~ → **Resolved: Node.js (Express).**
2. ~~Dashboard: fully custom UI, or embed Jira's board view inside a lighter custom shell?~~ → **Resolved: fully custom UI (React/Vite), reading through the Express API, not embedding Jira directly.**
3. ~~Do you already have a Jira Cloud instance + API token, or do we start from account creation?~~ → **Resolved: existing Jira Cloud instance in use since Phase 0.**
4. ~~Data store: SQLite or defer?~~ → **Resolved: SQLite (`better-sqlite3`) added in Phase 5.** Path: `backend/data/roadmap.db`. Stores `WeeklyCheckIn` and `RebalanceSuggestion` history (not a natural fit for Jira). Not needed for Phases 0–4.
5. ~~Deployment target: Azure?~~ → **Resolved: Vercel (frontend) + Render (backend free tier).** Azure deferred — it remains the right final target for the cloud cert track but adds setup friction. Vercel + Render get the project live in Phase 5 with zero cost and minimal config. Migrate to Azure later as a deliberate cloud-track exercise.
6. ~~LLM model for FR6 (rebalancing)?~~ → **Resolved: `nvidia/nemotron-3.5-lightning-30b-a3b` via NVIDIA NIM.** Fastest 30B A3B MoE, purpose-built for specialized agentic tasks. Confirmed free endpoint on account. Note: this is a **different model** from the broken `nvidia/nemotron-3-nano-30b-a3b` (old Nano that returned empty options). Fallback: `deepseek-ai/deepseek-v4.1-flash`.
7. ~~LLM model for FR7 (plan chat)?~~ → **Resolved: `nvidia/nemotron-3-ultra-550b-a55b` via NVIDIA NIM.** 1M context window handles the full roadmap document + entire conversation history with enormous headroom. Explicitly strong at agentic reasoning and planning. Same NIM API key as FR6.