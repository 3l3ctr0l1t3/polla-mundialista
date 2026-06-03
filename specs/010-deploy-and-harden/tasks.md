# 010 — Tasks

- [x] 1. Deploy Firestore rules + indexes to `la-pollita-corp`.
- [x] 2. Deploy hosting (full app) → https://la-pollita-corp.web.app (HTTP 200, title OK).
- [x] 3. Security-rules review: emulator rules-tests green (35); two-writers + kickoff lock verified.
- [x] 4. Secret scan: no secrets in tracked files/history; `.env.local` untracked; service account never in repo.
- [x] 5. Quality gates green: build, app tests (65), rules tests (35), ingest tests (9), lint, prettier.
- [ ] 6. PENDING (creds): end-to-end smoke — two Google accounts sign in, predict, `workflow_dispatch`
      ingests, leaderboard updates live; pre/post-kickoff lock behaves. Requires Google provider + key + service account.
- [ ] 7. PENDING (creds): schedule + confirm the ingestion cron in the public repo with the 3 secrets.
- [ ] 8. PENDING: apply real design (reskin 009) + Lighthouse pass; then freeze before June 11.

## Verification command(s)
```
firebase deploy
npm run build && npm test && npm run test:rules && npm run test:ingest && npm run lint
curl -s -o /dev/null -w "%{http_code}" https://la-pollita-corp.web.app
```
