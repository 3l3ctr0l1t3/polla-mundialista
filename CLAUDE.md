# CLAUDE.md — Polla Mundialista

Operating manual for this repo. Read every session. For the non-negotiable principles, see
[`specs/constitution.md`](specs/constitution.md).

## What this is
**Polla Mundialista** — a FIFA World Cup 2026 score-prediction pool for a small group of friends
(Colombian "polla"). Friends predict the scoreline of each match, earn tiered points, and compete on a
live leaderboard. Tournament runs **June 11 – July 19, 2026**.

## How we work — Spec-Driven Development (SDD)
Every unit of work is a **ticket = a folder under `specs/NNN-slug/`** containing `spec.md` (what/why +
acceptance rules), `plan.md` (technical design), `tasks.md` (checklist). **No app code without an approved
`spec.md`.** Flow: **Constitution → Specify → Plan → Tasks → Implement → Verify.**

Drive it with these skills (slash commands):
- `/spec-new <slug>` — scaffold the next ticket from templates + draft `spec.md`
- `/spec-plan <id>` — generate `plan.md` from an approved `spec.md`
- `/spec-tasks <id>` — generate `tasks.md` from `plan.md`
- `/spec-implement <id>` — implement the ticket (routes to a specialist subagent), checking off tasks
- `/spec-verify <id>` — run acceptance checks against the ticket's spec

Ticket index + status: [`specs/backlog.md`](specs/backlog.md).

## Tech stack
- **Frontend:** React + MUI (Material Design 3) + Vite + TypeScript
- **Backend/data:** Firebase **free Spark plan** — Hosting + Cloud Firestore + Auth (Google sign-in).
  No Cloud Functions (Spark forbids them).
- **Results ingestion:** Node/TS script run by a **public-repo GitHub Actions cron**, polling
  **football-data.org** (`WC`, season `2026`) and writing results via `firebase-admin`.
- **Scoring:** tiered & configurable — exact=5, outcome=3, goal-diff bonus=1.

## Folder map
```
CLAUDE.md                 this file
.claude/agents|skills      the harness (subagents + SDD skills)
.claude/settings.json      permissions + hooks
specs/                     constitution, templates, backlog, ticket folders
src/                       React app (created in ticket 001)
  shared/scoring.ts        the ONE scoring engine (imported by the ingestion job too)
  theme/                   MD3 tokens — all Material Design 3 specifics live here
  firebase/                SDK init, auth, typed Firestore converters
scripts/ingest/            Node/TS ingestion job (ticket 008)
.github/workflows/ingest.yml  cron (ticket 008)
firestore.rules            security rules — the integrity backbone
```

## Run commands
- `npm run dev` — Vite dev server
- `npm run build` — type-check + production build
- `npm test` — unit tests (Vitest)
- `firebase emulators:start` — Firestore emulator (for rules tests)
- `npm run ingest` — run the ingestion job locally (needs a gitignored local admin key)
- `firebase deploy` — deploy hosting + rules

## Conventions
- **TypeScript everywhere**, `strict` on. The scoring engine is a single shared module — never duplicate it.
- **All MD3 theming lives in `src/theme/`**; components consume tokens, not hard-coded colors.
- **Never commit secrets.** This repo is **public**. API keys + service-account JSON go in GitHub Secrets;
  `.env.local` and any local admin key are gitignored.
- **Two-writers rule:** the browser writes only the user's own prediction (pre-kickoff); results/leaderboard
  are written only by the ingestion service account. See the constitution.
- One ticket per branch/PR; conventional commits.
