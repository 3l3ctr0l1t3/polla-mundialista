# CLAUDE.md — Polla Mundialista

Operating manual for this repo. Read every session. For the non-negotiable principles, see
[`specs/constitution.md`](specs/constitution.md).

## What this is
**Polla Mundialista** — a FIFA World Cup 2026 score-prediction app (Colombian "polla"). It is now a
**multi-pool product**: any signed-in user can **create/own groups** and **join multiple groups**; each
group has its own members, **per-group predictions**, and its own live leaderboard. Tournament runs
**June 11 – July 19, 2026**.

## Current state (2026-06-03)
- **Live:** https://la-pollita-corp.web.app · Firebase project **`la-pollita-corp`** (Spark, free) ·
  Firestore `(default)` in **southamerica-east1** (São Paulo).
- **Built & committed (tickets 001–012):** scaffold, Google auth, data model + security rules, fixtures/
  results UI, prediction input + kickoff lock, scoring engine, leaderboard, **multi-tenant groups (012)**,
  default MD3 theme, ingestion automation. Status per ticket: [`specs/backlog.md`](specs/backlog.md).
- **Data seeded:** 104 matches (with flags) + 12 group standings (football-data, season 2026).
- **Ingestion LIVE:** public repo **github.com/3l3ctr0l1t3/polla-mundialista** with Actions secrets set;
  the `ingest` cron auto-updates during the tournament (early-exits before June 11). CI run verified.
- **Pending polish:** apply the user's real design (reskin `src/theme/`), group switcher / invite-code
  links / leave-group, Lighthouse. Scoring note: with the default config an **exact** scoreline scores
  **6** (exact 5 + goal-diff bonus 1) — confirm if a flat 5 is wanted.

## Data model (since ticket 012)
- **Per-group** (under `groups/{groupId}/`): `members/{uid}` (request→approve; owner is implicit via
  `groups/{gid}.ownerUid`), `predictions/{uid}_{matchId}`, `leaderboard/{uid}`.
- **Global** (top-level, shared by all groups): `matches/{fdId}`, `standings/{A..L}`, `config/*`,
  `users/{uid}`, `serverTime/{uid}`.
- **Access:** open Google sign-in (no app-level gate); membership/approval is **per group**.

## How we work — Spec-Driven Development (SDD)
Every unit of work is a **ticket = a folder under `specs/NNN-slug/`** (`spec.md` what/why + acceptance
rules · `plan.md` design · `tasks.md` checklist). **No app code without an approved `spec.md`.**
Flow: **Constitution → Specify → Plan → Tasks → Implement → Verify.** Skills:
`/spec-new <slug>` · `/spec-plan <id>` · `/spec-tasks <id>` · `/spec-implement <id>` · `/spec-verify <id>`.
Implementation routes to specialist subagents (firestore-rules-engineer, react-mui-builder,
ingestion-engineer, acceptance-verifier).

## Tech stack
- **Frontend:** React 19 + MUI v9 (Material Design 3) + react-router-dom v7 + Vite 7 + TypeScript (strict).
- **Backend/data:** Firebase **Spark (free)** — Hosting + Firestore + Auth (Google). No Cloud Functions.
- **Ingestion:** Node/TS (`firebase-admin`, `tsx`) run by a **public-repo GitHub Actions cron**, polling
  **football-data.org** v4 (`WC`, season `2026`). Tooling note: **Node 22.11** is pinned (Vite 7 / Vitest 3 /
  jsdom 26 — newer majors need Node 22.12+).
- **Scoring:** tiered & configurable — exact=5, outcome=3, goal-diff bonus=1 (`src/shared/scoring.ts`).

## Folder map
```
CLAUDE.md · .claude/{agents,skills,hooks,settings.json}   harness (subagents, SDD skills, secret-guard hook)
specs/                     constitution, templates, backlog, ticket folders 001–012
src/
  shared/scoring.ts        the ONE scoring engine (imported by the ingestion job too)
  shared/types.ts          Firestore doc types (Group, Member, Match, Prediction, LeaderboardEntry, …)
  firebase/                config.ts (SDK init), auth.ts, db.ts (typed converters + group-scoped refs)
  auth/                    AuthProvider (user/loading only — open sign-in), useAuth
  group/                   GroupProvider/useGroup, GroupApp, invite code
  pages/                   MyGroups, CreateGroup, JoinGroup, Fixtures, Predictions, Leaderboard, Standings, Admin, Login
  components/              AppShell, MatchCard, PredictionInput, LeaderboardRow, states/, navItems
  hooks/                   useMyGroups, useGroupPredictions, useGroupLeaderboard, useMatches, useServerTime, …
  theme/                   MD3 tokens — all Material Design 3 specifics live here
scripts/ingest/            Node/TS ingestion job + sample fixtures + node-env tests (ticket 008/012)
test/rules/                Firestore emulator security-rules tests
.github/workflows/ingest.yml   results cron
firestore.rules            security rules — the integrity backbone
.env (gitignored)          local ingestion creds; scripts/ingest/serviceAccount.json (gitignored)
```

## Run commands
- `npm run dev` — Vite dev server · `npm run build` — type-check + build · `npm test` — app unit tests
- `npm run test:rules` — Firestore emulator security-rules tests (needs Java; provided)
- `npm run test:ingest` — offline ingestion unit tests (no creds/network)
- `npm run lint` · `npx prettier --check .`
- `INGEST_FORCE=1 npm run ingest` — run ingestion locally (reads `.env` + `scripts/ingest/serviceAccount.json`;
  FORCE bypasses the tournament-window guard)
- `firebase deploy` — deploy hosting + rules + indexes (CLI logged in as the project owner)

## Conventions
- **TypeScript everywhere**, `strict` on. The scoring engine is one shared module — never duplicate it.
- **All MD3 theming lives in `src/theme/`**; components consume tokens, not hard-coded colors.
- **Never commit secrets.** Repo is **public**. Keys live in GitHub Actions secrets / gitignored local files
  (`.env`, `*serviceAccount*.json`); a PreToolUse **secret-guard hook** blocks committing them.
- **Two-writers rule:** the browser writes only the signed-in user's own **per-group** prediction
  (pre-kickoff); match results, standings, and every group's leaderboard are written **only by the ingestion
  service account**. See the constitution.
- **Authoritative kickoff lock** via Firestore rules (`request.time < match.kickoff`), never the client clock.
- One ticket per commit/PR; conventional commits. Keep `specs/backlog.md` status current.
