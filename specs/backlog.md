# Backlog — Polla Mundialista

Status legend: ⬜ not started · 🟦 spec ready · 🟨 in progress · ✅ verified

Dependency order: 001 → 002 → 003 → (004, 006 parallel) → 005 → 007 → 008 → 009 → 010

| ID  | Ticket | Status | Depends on | Specialist agent |
|-----|--------|--------|-----------|------------------|
| 001 | Project scaffold & tooling | ✅ | — | react-mui-builder |
| 002 | Auth & participant identity | 🟦 | 001 | react-mui-builder |
| 003 | Data model & security rules | 🟦 | 001 | firestore-rules-engineer |
| 004 | Fixtures & results display | 🟦 | 003 | react-mui-builder + ingestion-engineer |
| 005 | Prediction input & kickoff lock | 🟦 | 003 | react-mui-builder + firestore-rules-engineer |
| 006 | Scoring engine | 🟦 | 001 | ingestion-engineer |
| 007 | Leaderboard | 🟦 | 003, 006 | react-mui-builder + ingestion-engineer |
| 008 | Ingestion automation (cron) | 🟦 | 004, 006 | ingestion-engineer |
| 009 | MD3 theming & polish | 🟦 | 002 | react-mui-builder |
| 010 | Deploy & harden | 🟦 | all | acceptance-verifier |

## Deployment
- **Project:** `la-pollita-corp` (Firebase Spark) · **Live:** https://la-pollita-corp.web.app
- **Firestore:** `(default)` in **southamerica-east1** (São Paulo), closed rules until ticket 003
- **Auth:** Google provider — enable in console before ticket 002

## Milestones
- **Early June 2026:** 001–007 verified.
- **Before June 11 kickoff:** 008–010 verified, app frozen.
