# Backlog — Polla Mundialista

Status legend: ⬜ not started · 🟦 spec ready · 🟨 code complete (runtime pending) · ✅ verified

Dependency order: 001 → 002 → 003 → (004, 006 parallel) → 005 → 007 → 008 → 009 → 010

| ID  | Ticket | Status | Depends on | Specialist agent |
|-----|--------|--------|-----------|------------------|
| 001 | Project scaffold & tooling | ✅ | — | react-mui-builder |
| 002 | Auth & participant identity | 🟨 | 001 | react-mui-builder |
| 003 | Data model & security rules | ✅ | 001 | firestore-rules-engineer |
| 004 | Fixtures & results display | 🟨 | 003 | react-mui-builder + ingestion-engineer |
| 005 | Prediction input & kickoff lock | 🟨 | 003 | react-mui-builder + firestore-rules-engineer |
| 006 | Scoring engine | ✅ | 001 | ingestion-engineer |
| 007 | Leaderboard | 🟨 | 003, 006 | react-mui-builder + ingestion-engineer |
| 008 | Ingestion automation (cron) | ✅ | 004, 006 | ingestion-engineer |
| 009 | MD3 theming & polish | 🟨 | 002 | react-mui-builder |
| 010 | Deploy & harden | 🟨 | all | acceptance-verifier |
| 011 | Self-enrollment & admin approval | 🟨→012 | 002, 003 | firestore-rules-engineer + react-mui-builder |
| 012 | Multiple groups (multi-tenant) | 🟨 | 011 | rules + react-mui + ingestion |
| 013 | Full roster + reveal predictions at kickoff | 🟨 | 012 | firestore-rules-engineer + react-mui-builder |

> 012 restructures predictions/leaderboard/membership to be **per-group** (supersedes the single-pool
> parts of 005/007/011); matches/standings/config stay global. Built in phases A–D (see 012/plan.md).

✅ = fully verified offline. 🟨 here = **code complete, all unit/rules tests green, committed** —
awaiting the runtime credentials/toggles below to be verified end-to-end and promoted to ✅.

## Deployment
- **Project:** `la-pollita-corp` (Firebase Spark) · **Live:** https://la-pollita-corp.web.app
- **Firestore:** `(default)` in **southamerica-east1** (São Paulo); real security rules deployed (ticket 003)
- **Quality gates green:** `npm run build`, `npm test` (app), `npm run test:rules`, `npm run test:ingest`, `npm run lint`, prettier
- **GitHub repo (public):** https://github.com/3l3ctr0l1t3/polla-mundialista — Actions secrets set
  (`FOOTBALL_DATA_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`); `ingest` workflow active.
- **Seeded data:** 104 matches + 12 group standings (football-data, season 2026). Cron auto-updates
  during the tournament (June 11–July 19); before then scheduled runs early-exit. CI run verified ✅.

## PENDING — your follow-ups to promote 🟨 → ✅
1. **Enable Google sign-in** (unblocks 002, then live-verifies 004/005/007 in the browser):
   Console → Build → Authentication → Get started → **Google** → Enable (set support email).
2. **Groups (ticket 012, supersedes 011's single pool):** no admin bootstrap needed. Sign in → **My Groups**
   → **Create group** (you become its owner/admin) → share the **/join/:gid** link → friends request to join
   → approve them in that group's **Admin** page. Predictions + leaderboard are per-group. (The old
   app-level `isAdmin`/allowlist gate is gone.)
3. **football-data.org API key** + **Firebase service-account key** → enables real fixture seeding (004)
   and live ingestion (008). See `scripts/ingest/README.md`. Locally: `INGEST_FORCE=1 npm run ingest`.
4. **Public GitHub repo + 3 Actions secrets** (`FOOTBALL_DATA_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`,
   `FIREBASE_PROJECT_ID`) → activates the cron (008).
5. **Design:** first-pass dark-neon "La Pollita" theme APPLIED (009 — Barlow type, dark palette, neon glow,
   deployed). Remaining: a **pixel pass from screenshots** (LIVE-dot pulse, enter/toast animations,
   mint-tinted card strokes, large condensed score/point numerals) + Lighthouse.
6. **Confirm scoring intent** (006/008): with the default config an **exact** scoreline scores **6**
   (exact 5 + goal-diff bonus 1), since an exact result always has the right goal difference. If you
   want exact to be a flat 5, set `goalDiffOnlyOnCorrectOutcome` aside and exclude the bonus on exact.

## Milestones
- **Early June 2026:** 001–007 implemented. ✅ 001/003/006; 🟨 002/004/005/007 pending the toggles above.
- **Before June 11 kickoff:** wire credentials, seed fixtures, enable cron, reskin, freeze.
