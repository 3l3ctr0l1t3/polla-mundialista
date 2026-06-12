# 035 — Real-time-ish ingestion: reliable scheduling on Cloud Functions + fresher live scores

> Status: 🟦 spec ready · Depends on: 008, 033 · Specialist: ingestion-engineer

## Why
The ingestion cron runs on **GitHub Actions scheduled crons**, which drift badly on the free tier — observed
live on 2026-06-12 a tick scheduled for **04:20 UTC actually fired at 04:56 UTC (~36 min late)**. The project
moved to the **Blaze** billing plan on 2026-06-11, so we can move the cron to **Firebase Scheduled Functions
(v2 `onSchedule`) backed by Cloud Scheduler**, which fire on time (seconds, not tens of minutes) and let us
poll frequently. Because ticket 033 made every empty tick a cheap no-op, frequent polling is cheap on our
side; the only remaining bottleneck is the **data source's freshness + rate limit**. Intended outcome: a
finished match grades within a **few minutes** of full-time, reliably, at trivial cost.

## User story
As a **participant**, I want **my predictions to grade within a few minutes of full-time, every match,
reliably** so that **the leaderboard is fresh and I'm not staring at an un-updated board 30+ minutes after a
game ends because a free cron drifted or the data source lagged**.

## Scope
- **Migrate scheduling to Firebase Scheduled Functions** (`onSchedule` from `firebase-functions/v2/scheduler`,
  backed by Cloud Scheduler), in a new `functions/` workspace, **reusing the existing `runIngest()` core and
  the `scripts/ingest/` modules** (including `src/shared/scoring.ts` via the same shared engine) — no grading
  code is duplicated or reimplemented in the Function. Deployed via `firebase deploy --only functions`.
- **Run as the project's own service account via Application Default Credentials (ADC)** — `firebase-admin`
  auto-initializes inside the Function with no JSON key. The `FIREBASE_SERVICE_ACCOUNT` JSON secret is
  **dropped entirely** from the pipeline. The football-data API key is provided to the Function from **Secret
  Manager** (a functions secret param), never committed.
- **Frequent polling during live windows.** The Function polls every ~2–5 min while matches may be in play and
  sparser off-hours/idle, leaning on ticket 033's no-op guard so empty ticks perform ~zero per-group work.
  Keep the **June 11 – July 19, 2026** tournament-window early-exit and the `INGEST_FORCE`/manual-trigger
  bypass.
- **Latency budget:** a finished match is graded within **≤ ~5 min** of the chosen data source publishing the
  final 90' (`status: FINISHED` + full-time score) — see acceptance rule 4 for how this is made checkable.
- **Data-source evaluation (research, below).** A grounded comparison of free/cheap WC-2026 score sources,
  ending in a recommendation; if a source switch is warranted it becomes a **spike task** in `plan.md`, not an
  immediate commit.
- **GitHub Actions disposition.** Decide and document the fate of `.github/workflows/ingest.yml` (recommend
  below).
- **Tests.** The node-env ingestion suite stays green; any new data-source client is unit-tested offline with
  an injected `fetch` (the same pattern as `scripts/ingest/footballData.ts`).

## Non-goals
- **Live minute-by-minute animated UI scoreboard** — explicit **STRETCH**. Grading needs only the final 90'
  result; in-play scores are a separate UI concern (see open questions).
- **Scraping or any ToS-violating source.** Undocumented/unofficial endpoints (e.g. ESPN, FIFA internal) are
  evaluated but **rejected for the primary path** unless clearly permitted; documented APIs are preferred.
- **Changing scoring math or grading semantics** (006 / 025 / 033 / 034 stay as-is). The single shared engine
  is untouched.
- **Migrating any other part of the app to Cloud Functions** — this ticket covers the ingestion cron only.
  Predictions are still written client-side under security-rule control.
- **Real-time push notifications** — those are tickets 021–023.

## Constitution amendment required
This ticket **contradicts Principle 6 as currently written** — it says Firebase **Spark (no Cloud Functions)**.
Moving the cron to Cloud Functions on Blaze requires amending §6. **The user must approve and apply this
amendment to `specs/constitution.md` separately — this spec does NOT edit the constitution.**

Proposed replacement wording for Principle 6 (for the user to apply):

> **6. Cost-controlled by default.** The web app and Firestore run on Firebase. The project is on the
> **Blaze (pay-as-you-go)** plan as of 2026-06-11, used **only** for the ingestion cron (Firebase Scheduled
> Functions + Cloud Scheduler) and for staying within the always-free usage tiers otherwise. football-data.org
> is used on its **free tier**. **No change may introduce a paid dependency or a new billable resource without
> an explicit, documented decision in a ticket** — and any such change must keep projected cost negligible
> (target: within the always-free Cloud Scheduler/Functions allowances, ~$0/month at this scale).

Rationale notes for that decision: Cloud Scheduler bills **$0.10/job/month with 3 jobs/account free**, so one
(or two: live + idle) scheduled ingestion jobs sit within the free allowance; Cloud Functions invocation
volume at a ~2–5 min cadence during a ~5-week window is well within the always-free tier. (Confirm exact
projected cost in `plan.md`.)

## Data-source evaluation (research — 2026-06-12)

For **grading**, we only need the **final 90' score promptly** (`status: FINISHED` + full-time score). Live
minute-by-minute scores are only needed for a **live UI scoreboard (stretch)** and are NOT required by the
acceptance rules. The table below scores each candidate; numbers are cited from public docs/blogs and any
uncertain figure is marked **verify in spike**.

| Source | WC-2026 coverage | Final-score / live freshness | Free rate limit | ToS / legitimacy | Cost (Blaze impact) | Notes |
|---|---|---|---|---|---|---|
| **football-data.org** (current) | WC listed in free competitions; we already have 104 matches seeded | Free tier is **delayed**, not real-time; observed the `?status=FINISHED` endpoint leads the unfiltered list (033 overlay). Final-score lag ~tens of minutes seen on the unfiltered list — **verify per-match in spike** | **10 req/min** (free) | Documented public API; legitimate | Free; no Blaze cost beyond Functions | Already integrated, throttled client, tested. Frequent polling of `?status=FINISHED` is the cheap lever |
| **API-Football / api-sports.io** (incl. RapidAPI) | 1,100+ leagues incl. WC; live scores | Live scores supported on paid; **free = 100 req/day** total (resets 00:00 UTC) — too few for ~2–5 min polling over a tournament day | **100 req/day** (free); Pro $19/mo = 7,500/day | Documented public API; legitimate | Free tier too tight; paid is a real cost | 100/day ≈ 1 call / 14 min max — cannot sustain live-window polling |
| **TheSportsDB** | Multi-sport incl. football; WC presence **verify in spike** | **2-min livescores** are a **paid ($9/mo) V2** feature; free/demo key core lookups only | **~30 req/min** (free/demo key) | Documented; legitimate | Livescore needs $9/mo paid | Decent rate limit, but live scores are behind the paywall |
| **Sportmonks** | Full WC-2026: all 104 matches, live <15s | Excellent (paid) | n/a on free | Free plan = **Danish/Scottish leagues only, no WC**; WC plan **EUR 69/mo+** | Paid only for WC | Best freshness but clearly a paid dependency — out of scope for free-tier goal |
| **ESPN `site.api.espn.com` scoreboard** | Soccer scoreboard incl. major comps; WC **verify in spike** | Generally fast/near-real-time (powers espn.com) | Undocumented; no published limit | **Unofficial / undocumented**; heavy automated use **may violate ESPN ToS**; no SLA, can change without notice | Free but legally/operationally risky | **Rejected as primary** per non-goals; at most an unsupported supplemental source if ToS permits |
| **FIFA internal/undocumented endpoints** | WC native | Likely fast | Undocumented | Unofficial/undocumented; same ToS risk class as ESPN | Free but risky | **Rejected as primary** — undocumented |
| **openfootball/worldcup.json** | Open public-domain WC data incl. 2026, no key | **Schedule/result data, not live** — community-maintained, not a real-time feed | No key / no limit | Public domain; fully legitimate | Free | Useful as a static/backup schedule source, **not** for prompt live final scores |

**RECOMMENDATION:** **Stay on football-data.org and poll the fresher `?status=FINISHED` endpoint more often.**
The 033 overlay already shows that endpoint leads the unfiltered list; combining on-time Cloud Scheduler firing
with a ~2–5 min poll of `?status=FINISHED` should land most matches inside the ≤5 min budget at **$0 data
cost**, within the 10 req/min free limit. None of the surveyed alternatives offer prompt WC-2026 final scores
on a free, **legitimate** tier (API-Football's 100/day is too tight; TheSportsDB/Sportmonks live is paid; ESPN/
FIFA are undocumented/ToS-risky). **Therefore: do NOT switch blindly.** `plan.md` should include a short
**SPIKE** task to measure football-data.org's actual final-score lag on `?status=FINISHED` across a few live
matches; only if it consistently misses the ≤5 min budget should a switch/supplement be reconsidered (and that
itself becomes a follow-up ticket, given the cost/ToS tradeoffs above).

**GitHub Actions disposition — RECOMMENDATION:** once the Scheduled Function is live and verified, **retire the
`.github/workflows/ingest.yml` cron** to avoid two writers racing on the same Firestore (both would run the
same `runIngest()`; concurrent writes are idempotent but wasteful and confusing). Keep the workflow file in
git **disabled** (manual `workflow_dispatch`-only, schedule removed) as a documented break-glass fallback that
can be re-enabled if Functions are unavailable. `plan.md` confirms the exact disposition.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. **Scheduled Function deployed and reuses the shared core.** A `functions/` entrypoint exports a v2
   `onSchedule` handler that calls the existing `runIngest()` (importing `scripts/ingest/` + the shared scoring
   engine — verified by import graph, no grading logic copied). `firebase deploy --only functions` succeeds and
   the function appears in Cloud Functions / Cloud Scheduler.
2. **No service-account JSON anywhere.** The Function initializes `firebase-admin` via ADC (no key file); the
   `FIREBASE_SERVICE_ACCOUNT` secret is removed from the pipeline (grep of repo + workflow shows it is gone).
   The football-data API key is read from **Secret Manager** (a declared functions secret), and a repo grep
   confirms no key literal is committed (secret-guard hook still passes).
3. **On-time firing.** The schedule is defined via Cloud Scheduler (cron/interval in the `onSchedule` config);
   plan/verification records an observed (or scheduler-config-evidenced) **actual fire time within seconds of
   the scheduled time**, not the tens-of-minutes Actions drift — i.e. the drift problem is resolved.
4. **Latency budget checkable.** The cadence + 033 overlay are configured so a match's `status: FINISHED` +
   full-time score, once published by football-data.org's `?status=FINISHED` endpoint, is graded on the **next
   tick (≤ ~5 min)**. Verified by: (a) the live-window poll interval is ≤5 min, and (b) a node-env test proving
   that given a newly-FINISHED match in the fetched payload, `runIngest()` grades it on that tick (no extra
   delay introduced by the Function wrapper).
5. **Tournament-window guard + force bypass preserved.** The Function early-exits outside June 11 – July 19,
   2026 (unless forced), and a manual trigger / `INGEST_FORCE` path still forces a full pass — covered by the
   existing/extended node-env tests.
6. **Idle/live cadence documented.** `plan.md` records the chosen live-window and idle poll cadences and shows
   projected Cloud Scheduler + Functions cost is within the always-free allowances (target ~$0/month).
7. **GitHub Actions disposition applied.** The `ingest.yml` schedule is retired per the recommendation (or the
   alternative the planner justifies); the repo reflects the decision (no two on-time crons writing
   concurrently in steady state).
8. **Suite green.** `npm run test:ingest` stays GREEN (existing + any new data-source-client tests); any new
   offline client uses an injected `fetch` like `footballData.ts`; `npm run lint` and `npx prettier --check` on
   touched files pass.
9. **Constitution amendment recorded.** The proposed §6 amendment (above) is surfaced for the user to apply;
   the ticket is not marked done until the user has approved/applied it to `specs/constitution.md` (tracked,
   not edited by this ticket).

## Constitution links
- **Principle 6 (free-tier only) — AMENDED by this ticket.** See "Constitution amendment required"; the move to
  Blaze + Cloud Functions for the ingestion cron requires the user to apply the proposed §6 replacement. Cost
  stays negligible (Cloud Scheduler 3-jobs-free + always-free Functions tier).
- **Principle 3 (Two-writers rule).** The Scheduled Function is the **sole server-side writer** of match
  results, standings, and leaderboards — exactly the role the GitHub Action held. Retiring the Action prevents
  a second concurrent server writer. The browser still writes only its own pre-kickoff predictions.
- **Principle 2 (single shared scoring engine).** The Function reuses `runIngest()` and `src/shared/scoring.ts`;
  grading is not duplicated.
- **Principle 5 (no secrets in repo).** ADC drops the service-account JSON entirely; the API key lives in Secret
  Manager. Repo stays clean (secret-guard hook).
- **Principle 7 (done = tested).** Node-env ingestion tests stay green; new clients are unit-tested offline.

## Notes / open questions
- **Poll cadence (live vs idle).** Exact intervals for live vs idle windows are for the planner. Option A: one
  fixed interval (e.g. every 3 min) all day during the window — simplest, still cheap thanks to 033's no-op
  guard. Option B: two scheduled jobs (frequent during likely-live hours derived from kickoff times, sparse
  otherwise). Decide whether to derive "a match may be live now" from kickoff times to poll faster only then.
- **Switch data source now vs spike-then-decide.** Recommendation is **spike-then-decide** (stay on
  football-data.org, measure `?status=FINISHED` lag); the planner adds the spike task and only escalates to a
  follow-up ticket if the ≤5 min budget is consistently missed.
- **Retire vs keep GitHub Actions.** Recommendation: retire the schedule, keep the file as a disabled
  `workflow_dispatch`-only break-glass fallback. Planner confirms.
- **Live in-play scores in the UI (stretch).** Whether/when to surface minute-by-minute scores is out of scope
  here; if pursued later it would consume the same `?status=IN_PLAY`/live data and is a separate ticket.
- **Assumption — `functions/` workspace.** Assumes a new `functions/` directory in the Firebase project that
  imports the existing `scripts/ingest/` modules (path or local package). Planner resolves the exact module
  wiring so the shared scoring engine is imported once, not vendored.
- **Assumption — Node runtime.** Cloud Functions v2 supports a recent Node runtime; the repo pins Node 22.11 for
  Vite/Vitest tooling reasons. Planner confirms the Functions runtime (e.g. nodejs22) and that the ingestion
  modules run under it unchanged.
- **Concurrency.** Pin the Function to a single concurrent instance (max instances 1) so overlapping ticks can't
  double-run `runIngest()`; writes are idempotent but single-flight is cleaner. Planner confirms config.

## Sources (data-source research)
- [football-data.org — API policies (rate limits)](https://docs.football-data.org/general/v4/policies.html)
- [football-data.org — Pricing](https://www.football-data.org/pricing)
- [football-data.org — Coverage](https://www.football-data.org/coverage)
- [football-data.org free tier limits 2026 (TheStatsAPI)](https://www.thestatsapi.com/blog/football-data-org-free-tier-limits-2026)
- [API-Football — how ratelimit works](https://www.api-football.com/news/post/how-ratelimit-works)
- [API-Football — WC 2026 guide](https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports)
- [TheSportsDB — Free Sports API / pricing](https://www.thesportsdb.com/free_sports_api)
- [TheSportsDB — Pricing (V2 livescores)](https://www.thesportsdb.com/pricing)
- [Sportmonks — Free plan](https://www.sportmonks.com/football-api/free-plan/)
- [Sportmonks — World Cup API plans & coverage](https://www.sportmonks.com/football-api/world-cup-api/)
- [ESPN hidden API guide (ToS caveats)](https://zuplo.com/learning-center/espn-hidden-api-guide)
- [Public ESPN API (undocumented endpoints)](https://github.com/pseudo-r/Public-ESPN-API)
- [openfootball/worldcup.json (open public-domain WC data)](https://github.com/openfootball/worldcup.json)
- [Cloud Scheduler pricing ($0.10/job/mo, 3 free)](https://cloud.google.com/scheduler/pricing)
- [Firebase — Schedule functions (onSchedule v2)](https://firebase.google.com/docs/functions/schedule-functions)
