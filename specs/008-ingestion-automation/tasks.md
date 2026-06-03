# 008 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. Node TS config + node-env vitest config for the ingest job (`scripts/ingest/tsconfig.json`, `vitest.config.ts`).
- [x] 2. football-data v4 response types (`scripts/ingest/types.ts`).
- [x] 3. Rate-limited v4 client with `X-Auth-Token` + 429 backoff (`footballData.ts`).
- [x] 4. `firebase-admin` init from `FIREBASE_SERVICE_ACCOUNT` / local key path; no hard-coded secret (`firestoreAdmin.ts`).
- [x] 5. `mapMatch.ts` — football-data match → Firestore `Match` (id, Timestamp, status/score/stage/group/teams + TBD).
- [x] 6. `scoring.ts` — thin re-export of `src/shared/scoring.ts` (single source of truth).
- [x] 7. `buildLeaderboard.ts` — pure aggregation → dense-ranked `LeaderboardEntry[]` (tiebreakers points→exact→outcome→name).
- [x] 8. `index.ts` — orchestrate fetch→upsert→grade(scoringVersion guard)→leaderboard→standings→`config/meta`; early-exit window; non-zero on error.
- [x] 9. Saved sample responses (`sample/matches.json`, `sample/standings.json`).
- [x] 10. Unit tests (node env): `mapMatch.test.ts`, `buildLeaderboard.test.ts` using sample + real scoring engine.
- [x] 11. GitHub Actions cron `.github/workflows/ingest.yml` (dense/sparse + workflow_dispatch + secrets).
- [x] 12. `package.json` — add `ingest` + `test:ingest` scripts.
- [x] 13. `scripts/ingest/README.md` — secrets + local run + fixtures (PENDING credential steps).
- [x] 14. Run ingest unit tests offline and confirm pass.

## Verification command(s)
```
npm run test:ingest
```

## PENDING (cannot run offline)
- Real run (`npm run ingest`) needs `FOOTBALL_DATA_API_KEY` + a Firebase service-account JSON + `FIREBASE_PROJECT_ID`.
- Live cron needs a **public** GitHub repo with secrets `FOOTBALL_DATA_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`.
