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
- Triggers a suggestion **only if a track is off-pace for 2+ consecutive weekly check-ins**.
- Output is a structured suggestion (what's behind, by how much, 1-2 concrete rebalancing options), not an automatic plan rewrite. You approve or reject; approved changes update the config.
- Uses an LLM call (Claude API) with the structured pace data as context — not a free-form "how am I doing" prompt. Keep the input structured so output stays specific and actionable.

---

## 4. Non-Functional Requirements

- **Security**: Jira API tokens and Claude API keys stored as environment variables / secrets, never committed to GitHub. Use a `.env.example` file in the repo, real `.env` gitignored.
- **Cost**: Weekly LLM calls only (not daily) keeps API cost negligible. Daily todo generation is pure logic — no LLM call needed for that part.
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
              │ Rebalancing Agent │──▶ Claude API (structured prompt)
              │  (scheduled job)   │
              └─────────────────┘
```

The dashboard never talks to Jira directly — every read goes through the
Express API layer, which is the only place the Jira token lives. This was
the resolution to Open Decision #2 below: not a Jira board embed, but a
fully custom UI reading through the backend.

---

## 6. Suggested Tech Stack (adjust to what you're comfortable with — this is also a learning project)

| Layer | Suggestion | Why |
|---|---|---|
| Backend/API | Node.js (Express) — **built** | Either fits your Software Engineering track goals; pick whichever you want more reps in |
| Scheduled jobs | GitHub Actions (cron schedule) or a simple server-side cron | Free, versioned, visible in your GitHub activity |
| Data store | SQLite or a free-tier Postgres (Supabase/Azure) | Small dataset, no need for anything heavy — not yet needed, Jira + JSON files have covered it so far |
| Dashboard | React (Vite) — **built** | Matches frontend-design conventions, deployable free (Vercel/Azure Static Web Apps) |
| Jira integration | Jira REST API v3, raw fetch — **built** | Straightforward, well-documented |
| LLM calls | Claude API (Sonnet) | For the weekly rebalancing suggestions only — Phase 4, not yet built |
| Hosting | Azure (matches your cloud track from the roadmap) | Double-dips as Azure practice — not yet deployed, currently local-only |

---

## 7. Data Models (core entities)

- **RoadmapConfig**: quarter list, per-quarter active tracks, hour budgets, recovery week cadence
- **StriverProblem**: id, step, sub-step, name, difficulty, status (todo/done/skipped), date_completed, attempts
- **Track**: name, weekly target hours, cumulative hours logged, status (on-pace/behind/ahead)
- **DailyTodo**: date, task list (each with track label, Jira subtask ID, done status)
- **WeeklyCheckIn**: week number, per-track pace delta, consecutive-behind counter
- **RebalanceSuggestion**: date, tracks affected, suggested change, approved (bool)

---

## 8. Build Phases (matches the sequencing discussed earlier)

| Phase | Scope | Status |
|---|---|---|
| **Phase 0** | Jira project setup: epics, labels, manual story creation for Q1 | ✅ Done |
| **Phase 1** | Striver A2Z sheet as structured JSON + Jira sync script (read-only) | ✅ Done — full sheet, 18 steps / 474 problems, via Next.js flight-payload parsing |
| **Phase 2** | Daily todo generator (logic only, no LLM) + writes to Jira subtasks | ✅ Done |
| **Phase 3** | Dashboard v1: today's todos + basic progress views, reading from local DB/Jira | ✅ Done — Express API + React dashboard (Today / Board / Progress), reading live from Jira and the Striver JSON, no local DB needed yet. Extended with a done-button and drag-and-drop status changes (both optimistic-UI, updating instantly and rolling back only on failure), 30s auto-refresh polling, and server-side auto-transition of today's tasks from "To Do" to "In Progress" on first view each day |
| **Phase 4** | Weekly rebalancing agent (Claude API call, structured suggestions) | Not started — Month 2+, once real pace data exists |
| **Phase 5** | Polish: tests, CI/CD, deploy dashboard, README + architecture diagram | Not started |

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
4. Data store: still none — Jira + local JSON files (`striver-a2z.json`) have been sufficient through Phase 3. Revisit if Phase 4/5 needs to persist `WeeklyCheckIn` or `RebalanceSuggestion` history, since those don't have a natural home in Jira.
5. Deployment target: Azure was the original suggestion (double-dips as cloud-track practice) — not yet decided or started, relevant once Phase 5 begins.