# Constitution — Polla Mundialista

Immutable principles. Every ticket inherits these; a ticket may add rules but may not contradict the
constitution. Changing a principle here is a deliberate, reviewed act.

## Principles

1. **Spec-first.** No implementation without an approved `spec.md`. If behavior must change, the spec
   changes first — code serves the spec, not the reverse.

2. **TypeScript everywhere.** The web app, the ingestion job, and the **single shared scoring engine**
   (`src/shared/scoring.ts`, imported by the job) are all TypeScript. The scoring logic exists in exactly
   one place — no duplicated grading code.

3. **Two-writers rule.** There are exactly two writers to the database:
   - the **browser** (an authenticated participant) may write **only their own prediction, and only before
     that match's kickoff**;
   - the **ingestion service account** is the **only** writer of match results, leaderboard, and standings.
   The browser never writes results or points. Narrow carve-out (amended 2026-06-11): a group admin's
   browser may additionally **delete** (never create or update) prediction docs belonging to someone who
   is no longer a participant of that group, as part of member-removal cleanup.

4. **Authoritative kickoff lock.** Prediction locking is enforced in Firestore security rules using server
   time with a **10-minute pre-kickoff buffer** (`request.time < match.kickoff − 10min`). The client clock
   is never trusted; UI locking is convenience only. In a **strict** group (ticket 019) the same −10min
   buffer applies to the two batch windows instead of per match: all group-stage predictions lock 10 min
   before the first cup match, all knockout predictions 10 min before the first knockout match.

5. **No secrets in the repo.** The repository is **public**. The football-data.org API key and the Firebase
   service-account JSON live **only in GitHub Secrets**. Local admin keys and `.env.local` are gitignored.
   The web bundle contains only public Firebase config.

6. **Cost-controlled by default (Blaze, since 2026-06-11).** The web app and Firestore run on Firebase; the
   project is on the **Blaze (pay-as-you-go)** plan. Blaze is used **only** to (a) stay within the
   always-free usage tiers and (b) permit the **ingestion cron to run on Firebase Scheduled Functions +
   Cloud Scheduler** (enabled by ticket 035). football-data.org is used on its **free tier**; public-repo
   GitHub Actions remain available (free) as an alternative/fallback runner. **No change may introduce a paid
   dependency or a new billable resource without an explicit, documented decision in a ticket**, and any such
   change must keep projected cost negligible (target: within the always-free Cloud Scheduler/Functions
   allowances, ~$0/month at this scale). *(Amended 2026-06-12; supersedes the original "Spark only, no Cloud
   Functions" rule after the deliberate Blaze upgrade.)*

7. **Done = tested + meets acceptance rules.** A ticket is closed only when its `spec.md` acceptance rules
   pass. Scoring changes require unit tests; security-rule changes require Firestore emulator tests.

8. **Process.** One ticket per branch/PR. Conventional commits. Keep `specs/backlog.md` status current.

## Product invariants
- Competition: FIFA World Cup 2026 (`WC`, season `2026`) — 48 teams, 12 groups (A–L), 104 matches,
  Round of 32 included. Tournament window **June 11 – July 19, 2026**.
- Scoring (default, configurable via `config/scoring`): **exact score = 5**, **correct outcome = 3**,
  **goal-difference bonus = +1**. Matches graded only when `status === 'FINISHED'`.
- One prediction per participant per match, keyed `{uid}_{matchId}`.
