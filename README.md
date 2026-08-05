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
- [ ] Phase 3 — Dashboard (today's todos + progress views)
- [ ] Phase 4 — Weekly rebalancing agent (Claude API)
- [ ] Phase 5 — Tests/CI polish, deploy

## Quickstart

```bash
cd backend
cp .env.example .env   # fill in Jira credentials
npm install
npm run setup:jira      # Phase 0: creates quarter epics + track stories
npm run generate:today  # Phase 2: generates and pushes today's todos
npm test                 # run the logic tests
```

### Prerequisites

1. A Jira Cloud site with an empty project created (Kanban or Scrum), key
   matching `JIRA_PROJECT_KEY` in `.env`.
2. A Jira API token: https://id.atlassian.com/manage-profile/security/api-tokens
3. Node.js 18+

## Architecture

See [`SPEC.md`](./SPEC.md#5-architecture-proposed) for the full diagram.
Short version: `roadmap.config.json` + `striver-a2z.json` are the source of
truth; `generateDailyTodos.js` reads both plus current Jira state, and writes
today's subtasks back to Jira. Jira remains the single system of record —
the dashboard (Phase 3) will read from it, not duplicate it.

## Extending the Striver sheet

`backend/src/data/striver-a2z.json` is seeded with Steps 1-2 as a template.
Add the remaining steps by following the same structure — copy a `subSteps`
block, rename, and list problems in the order given at
https://takeuforward.org/strivers-a2z-dsa-course-sheet-2/
