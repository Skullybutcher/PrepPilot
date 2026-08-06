# Roadmap Copilot

A daily todo generator for a 12-month placement prep plan. Reads a quarterly
roadmap config and a Striver A2Z DSA sheet, checks actual progress against
plan via Jira, and generates each day's specific tasks — synced to Jira,
displayed on a dashboard.

Full design decisions and requirements: [`SPEC.md`](./SPEC.md)

## Status

- [x] Phase 0 — Jira project scaffolding script
- [x] Phase 1 — Striver A2Z sheet as structured data
- [x] Phase 2 — Daily todo generator (logic + Jira sync)
- [x] Phase 3 — Dashboard (today's todos + board + progress views)
- [ ] Phase 4 — Weekly rebalancing agent (NVIDIA NIM) + Conversational Plan Builder chat tab
- [ ] Phase 5 — Tests/CI polish, deploy

## Quickstart

### Backend

```bash
cd backend
cp .env.example .env    # fill in Jira credentials
npm install
npm run setup:jira      # Phase 0: creates quarter epics + track stories
npm run generate:today  # Phase 2: generates and pushes today's todos
npm run dev              # Phase 3: starts the API on http://localhost:4000
npm test                 # run the logic tests
```

### Frontend

```bash
cd frontend
cp .env.example .env    # defaults to http://localhost:4000/api, adjust if needed
npm install
npm run dev              # starts the dashboard on http://localhost:5173
```

Run the backend first — the dashboard has nothing to read otherwise.

### Prerequisites

1. A Jira Cloud site with an empty project created (Kanban or Scrum), key
   matching `JIRA_PROJECT_KEY` in `.env`.
2. A Jira API token: https://id.atlassian.com/manage-profile/security/api-tokens
3. Node.js 18+

## Architecture

See [`SPEC.md`](./SPEC.md#5-architecture-proposed) for the full diagram.
Short version: `roadmap.config.json` + `striver-a2z.json` are the source of
truth; `generateDailyTodos.js` reads both plus current Jira state, and writes
today's subtasks back to Jira. Jira remains the single system of record — the
dashboard reads from it live, it doesn't duplicate state into its own store.

### Backend API

A thin Express layer on top of the existing Jira client and Striver data,
purely for the dashboard to consume — no business logic lives here beyond
shaping the response.

| Endpoint | Returns |
|---|---|
| `GET /api/health` | Liveness check |
| `GET /api/todos/today` | Today's Jira subtasks, with track + status |
| `GET /api/board` | Subtasks grouped into To Do / In Progress / Done |
| `GET /api/progress` | DSA completion vs. `striver-a2z.json`, overall and per-step |

The frontend never talks to Jira directly — it only calls this API. Keeping
the Jira token server-side is the reason this layer exists rather than
hitting Jira from the browser.

### Frontend Dashboard

A Vite + React app (`/frontend`) with three views, tabbed:

- **Today** — today's generated subtasks, with track and status badges, a
  done-button per task, and 30s auto-refresh polling. Tasks still sitting in
  "To Do" auto-transition to "In Progress" the first time they're loaded
  each day (handled server-side, so it's correct regardless of which device
  opens the dashboard first).
- **Board** — a 3-column kanban (To Do / In Progress / Done) of Subtasks
  only, with native HTML5 drag-and-drop between columns. Drops update the UI
  optimistically (the card moves instantly; the Jira update happens in the
  background and rolls the card back if it fails), and the target column
  highlights while dragging.
- **Progress** — overall DSA completion %, plus a per-step breakdown across
  all 18 Striver A2Z steps

Configured via `VITE_API_URL` in `frontend/.env` so it can point at a
deployed backend later without code changes.

## Extending the Striver sheet

`backend/src/data/striver-a2z.json` is fully scraped — all 18 steps, 474
problems, sourced from the Next.js flight payload on
[takeuforward.org](https://takeuforward.org/strivers-a2z-dsa-course-sheet-2/)
rather than DOM scraping, so it stays accurate if the site's markup changes.
Re-run `npm run scrape:striver` in `backend/` if the source sheet is updated
upstream.

## Roadmap

- [x] Mark problems/todos done directly from the dashboard (done-button on
      Today, drag-and-drop on Board — both optimistic, no wait on Jira)
- [x] Auto-refresh or polling on the dashboard views (30s polling on Today
      and Board)
- [x] Today's tasks auto-transition to "In Progress" on first view each day
- [ ] Phase 4 — weekly rebalancing suggestions via NVIDIA NIM, triggered by
      either an off-pace track (2+ consecutive weekly check-ins) or a stale
      card (2+ weeks unchanged, detected via Jira's changelog API)
- [ ] Phase 4 — Conversational Plan Builder: a "Plan" chat tab for creating
      or revising the roadmap from a brain-dump or an existing plan, backed
      by `POST /api/plan/chat`, no RAG, no cross-session memory (re-grounds
      from the current `roadmap.config.json` each conversation), proposes a
      diff you approve before it writes
- [ ] Phase 5 — tests, CI, deployment

Screenshots are intentionally left out of this README for now — the
dashboard is still actively changing, so a screenshot would go stale fast.
Worth adding once Phase 5 stabilizes the UI.