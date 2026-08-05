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

## 5. Architecture (proposed)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Roadmap Config   │     │  Striver A2Z Data  │     │  Jira Cloud  │
│  (YAML/JSON)       │     │  (JSON)             │     │  (via REST)  │
└────────┬─────────┘     └────────┬──────────┘     └──────┬──────┘
         │                        │                        │
         └────────────┬───────────┴────────────┬───────────┘
                       ▼                        │
              ┌─────────────────┐               │
              │ Daily Generator  │──── writes ──▶│ (Jira subtasks)
              │  (scheduled job) │               │
              └────────┬─────────┘               │
                       │                          │
                       ▼                          ▼
              ┌─────────────────┐        ┌─────────────────┐
              │  Local DB/store   │◀──────│  Dashboard (web)  │
              │  (todos, progress)│        │  reads both        │
              └─────────────────┘        └─────────────────┘
                       ▲
                       │ weekly
              ┌─────────────────┐
              │ Rebalancing Agent │──▶ Claude API (structured prompt)
              │  (scheduled job)   │
              └─────────────────┘
```

---

## 6. Suggested Tech Stack (adjust to what you're comfortable with — this is also a learning project)

| Layer | Suggestion | Why |
|---|---|---|
| Backend/API | Node.js (Express) or Python (FastAPI) | Either fits your Software Engineering track goals; pick whichever you want more reps in |
| Scheduled jobs | GitHub Actions (cron schedule) or a simple server-side cron | Free, versioned, visible in your GitHub activity |
| Data store | SQLite or a free-tier Postgres (Supabase/Azure) | Small dataset, no need for anything heavy |
| Dashboard | React + Tailwind, or Next.js if you want SSR practice | Matches frontend-design conventions, deployable free (Vercel/Azure Static Web Apps) |
| Jira integration | Jira REST API v3, official Node/Python SDK or raw fetch | Straightforward, well-documented |
| LLM calls | Claude API (Sonnet) | For the weekly rebalancing suggestions only |
| Hosting | Azure (matches your cloud track from the roadmap) | Double-dips as Azure practice |

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

| Phase | Scope | Target |
|---|---|---|
| **Phase 0** | Jira project setup: epics, labels, manual story creation for Q1 | Week 1, ~2-3 hrs |
| **Phase 1** | Striver A2Z sheet as structured JSON + Jira sync script (read-only) | Week 1-2 |
| **Phase 2** | Daily todo generator (logic only, no LLM) + writes to Jira subtasks | Week 2-3 |
| **Phase 3** | Dashboard v1: today's todos + basic progress views, reading from local DB/Jira | Week 3-4 |
| **Phase 4** | Weekly rebalancing agent (Claude API call, structured suggestions) | Month 2+, once you have real pace data |
| **Phase 5** | Polish: tests, CI/CD, deploy dashboard, README + architecture diagram | Ongoing, finish by end of Month 2 |

Total build time budget: **~2 weeks of focused work**, ideally absorbed into Month 1's project slot plus one recovery week — not carved out of DSA time.

---

## 9. GitHub Workflow

- Repo structure: `roadmap-copilot/` with `/backend`, `/dashboard`, `/data` (Striver JSON, config), `/docs` (this spec + architecture diagram)
- Commit as you build each phase — real incremental history is part of the point (this is portfolio evidence of consistent work, which recruiters do look at)
- `README.md` at repo root: what it does, architecture diagram, setup instructions, screenshot of the dashboard
- `.env.example` committed, `.env` gitignored
- Once Phase 5 is done, this project itself becomes citable in your resume/interviews — worth writing a short design-decisions section (why Jira as system of record, why weekly not daily rebalancing, etc.) since interviewers often probe exactly these tradeoffs

---

## 10. Open Decisions (confirm before I generate starter code)

1. Backend language: Node.js or Python?
2. Dashboard: fully custom UI, or embed Jira's board view inside a lighter custom shell?
3. Do you already have a Jira Cloud instance + API token, or do we start from account creation?
