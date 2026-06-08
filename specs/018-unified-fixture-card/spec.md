# 018 — Unified fixture+prediction card; remove Predictions page

> Status: 🟦 spec ready · Depends on: 013, 017 · Specialist: react-mui-builder

## Why
Today predictions are split across two surfaces: a read-only `MatchCard` on the **Fixtures** page (score /
status + a reveal dialog) and a separate **Predictions** page (`PredictionCard` with score steppers). The
owner wants ONE surface: fold prediction entry directly into the fixture card and delete the Predictions
page. The new card adopts the centered layout already prototyped (and locked) in the superadmin Canvas as
`MatchLabCard` — for each team a centered column with the team NAME on top and its FLAG below, with the
prediction steppers (upcoming) or the result score (live/finished) centered beneath.

## User story
As a **group member**, I want to **predict, view, and reveal scores on a single Fixtures card** so that
**there is one place for everything about a match instead of bouncing between two pages**.

## Scope
- **Production unified card** (e.g. `src/components/FixtureCard.tsx` — the planner names it) replacing the
  role of `MatchCard` + `PredictionCard` on the Fixtures page. It MUST match the **locked centered layout**
  of `src/components/MatchLabCard.tsx` (caption + status on top; each team a centered column with NAME above
  FLAG; prediction/result centered beneath — flags sit between names and prediction/result; everything
  centered). Reuse that design; do not re-derive it.
- **Pre-kickoff (editable):** the card shows score steppers that SAVE. **Reuse the existing
  `PredictionInput` save logic** — `setDoc(groupPredictionDoc(gid, uid, matchId), payload, { merge: true })`
  writing only `uid`/`matchId`/`homeGoals`/`awayGoals`/`updatedAt` (and `createdAt` on first write), never
  `points`/`breakdown`. Include the kickoff lock (disable via `useServerTime` `now()`) and the existing
  countdown. Do NOT reimplement scoring or the write.
- **Live/finished:** the card shows the result score, the **viewer's own prediction** (subtly), and access
  to **everyone's predictions once the match has kicked off** via the existing reveal mechanism
  (`MatchPredictionsDialog` / `useMatchPredictions`, rules-gated). Own prediction is always visible to its
  owner; others' only after kickoff.
- **FixturesPage** renders the new card for every match. It loads the viewer's per-group predictions via
  `useGroupPredictions(gid)` and the server clock via `useServerTime` (as the old Predictions page did).
- **Delete the Predictions page:** remove `src/pages/PredictionsPage.tsx` and its `predictions` route in
  `src/group/GroupApp.tsx`; remove the `predictions` item (and its `nav.predictions` label/key usage) from
  `src/components/navItems.tsx`; redirect any `/g/:gid/predictions` navigation to `fixtures`. Remove the
  now-unused `PredictionCard` if nothing else uses it (planner verifies usages).
- **Localization:** all card copy uses `t()`, reusing existing `predictions.*` / `match.*` keys; any new
  keys are added to **both** `en.json` and `es.json` so the key-parity test stays green.
- **Tests:** add/replace FixturesPage tests and the new card's tests (save calls the correct ref/shape;
  locked after kickoff; steppers pre-kickoff vs score post; own prediction shown; reveal of others gated by
  kickoff). Remove/replace the PredictionsPage tests. Keep the full suite green.

## Non-goals
- Changing scoring (`src/shared/scoring.ts`), ingestion (`scripts/ingest/*`), or `firestore.rules` — no
  rules change in this ticket.
- Altering the reveal-permission rules (ticket 013 already enforces reveal-at-kickoff server-side).
- The superadmin Canvas / `MatchLabCard` — left as the dev sandbox, untouched as a feature.
- Offline/PWA behavior; redesigning Leaderboard/Standings; team-name translation.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. The Fixtures page shows **one card per match** in the locked centered layout (name above flag;
   prediction/result centered below). There is **no** separate Predictions page and **no** `predictions`
   nav item, and navigating to `/g/:gid/predictions` **redirects to `/g/:gid/fixtures`** — verified by a
   routing/nav test and a `MatchLabCard`-equivalent layout assertion on the new card.
2. For an upcoming match (before kickoff), a member can set home/away goals on the card and the save
   persists to `groups/{gid}/predictions/{uid}_{matchId}` with **only** `uid`/`matchId`/`homeGoals`/
   `awayGoals`/`updatedAt` (+`createdAt` on first write) and **never** `points`/`breakdown` — proven by a
   component test asserting the write ref and payload shape, reusing the existing `PredictionInput` save.
3. At/after kickoff the steppers + save are **disabled in the UI** (driven by the server-corrected
   `useServerTime` clock), and a late write is **rejected by `firestore.rules`** — the existing
   prediction-kickoff-lock rules tests still pass, and a UI test asserts the disabled state past kickoff.
4. On live/finished cards the viewer sees the **result score** and **their own prediction**; **others'**
   predictions are reachable only **once the match has kicked off** (existing reveal-at-kickoff mechanism),
   never before — verified by the existing/updated reveal tests (`MatchPredictionsDialog` /
   `useMatchPredictions`).
5. All card copy is localized in **en + es** and the i18n **key-parity test is green**.
6. Quality gates green: `npm run build`, `npm test` (incl. updated Fixtures/card tests; PredictionsPage
   tests removed/replaced), `npm run test:rules` (unchanged, still green), `npm run lint`, and
   `npx prettier --check .`.
7. **No change** to `src/shared/scoring.ts`, `scripts/ingest/*`, or `firestore.rules` — verified by diff;
   the rules and ingest suites are unchanged and still pass.

## Constitution links
- **Spec-first (1):** behavior change specified here before any implementation.
- **Shared scoring engine untouched (2):** scoring stays in `src/shared/scoring.ts`, not reimplemented.
- **Two-writers rule (3):** the browser writes **only** its own per-group prediction (pre-kickoff);
  results/standings/leaderboard remain admin-SDK-only.
- **Authoritative kickoff lock (4):** the UI lock is convenience via `useServerTime`; `firestore.rules`
  (`request.time < match.kickoff`) is the authority — unchanged here.
- **Free-tier only (6):** no new backend, no Cloud Functions, no paid dependency.
- **Done = tested + meets acceptance rules (7):** the gates in AC6/AC7 close the ticket.

## Notes / open questions
- **Assumption:** `MatchLabCard.tsx` is the locked, approved layout reference; the production
  `FixtureCard` matches its structure/centering but is fully wired (real save, real reveal, localized) and
  uses real `Match`/`Prediction` data instead of local `useState`. Planner picks the final filename.
- **Assumption:** the new card reuses `PredictionInput`'s save logic and kickoff lock rather than copying
  them — the planner decides whether to compose `PredictionInput` inside the card or extract its save into a
  shared hook, but the write path and lock behavior MUST be identical (no reimplementation).
- **Assumption:** the reveal entry point on the card opens the existing `MatchPredictionsDialog`
  (rules-gated by `useMatchPredictions`); the card never queries others' predictions for not-yet-kicked-off
  matches (keeps the query rules-legal, per ticket 013).
- **Assumption:** FixturesPage continues to list **all** matches (not only upcoming) and keeps its
  day-grouping; the card itself decides editable vs result rendering from `status`/`kickoff`. Planner to
  confirm whether finished and upcoming matches share the same list or stay visually sectioned.
- Planner verifies whether anything besides the Predictions page imports `PredictionCard` / `MatchCard`
  before deleting them; remove only if truly unused.
