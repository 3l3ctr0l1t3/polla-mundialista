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
   The browser never writes results or points.

4. **Authoritative kickoff lock.** Prediction locking is enforced in Firestore security rules using server
   time (`request.time < match.kickoff`). The client clock is never trusted; UI locking is convenience only.

5. **No secrets in the repo.** The repository is **public**. The football-data.org API key and the Firebase
   service-account JSON live **only in GitHub Secrets**. Local admin keys and `.env.local` are gitignored.
   The web bundle contains only public Firebase config.

6. **Free-tier only.** Firebase **Spark** (no Cloud Functions), football-data.org **free tier**, and
   **public-repo GitHub Actions** (unlimited minutes). No change may introduce a paid dependency without an
   explicit decision.

7. **Done = tested + meets acceptance rules.** A ticket is closed only when its `spec.md` acceptance rules
   pass. Scoring changes require unit tests; security-rule changes require Firestore emulator tests.

8. **Process.** One ticket per branch/PR. Conventional commits. Keep `specs/backlog.md` status current.

## Product invariants
- Competition: FIFA World Cup 2026 (`WC`, season `2026`) — 48 teams, 12 groups (A–L), 104 matches,
  Round of 32 included. Tournament window **June 11 – July 19, 2026**.
- Scoring (default, configurable via `config/scoring`): **exact score = 5**, **correct outcome = 3**,
  **goal-difference bonus = +1**. Matches graded only when `status === 'FINISHED'`.
- One prediction per participant per match, keyed `{uid}_{matchId}`.
