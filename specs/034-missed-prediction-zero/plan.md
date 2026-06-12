# 034 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.
> Layers on top of ticket 033's per-group aggregation refactor (land 033 first).

## Approach

Two independent surfaces, both derive the 0 — neither stores a phantom doc (constitution §3):

1. **Ingestion leaderboard aggregation (`buildLeaderboard.ts`).** Redefine `predictionsGraded` from
   "this participant's graded prediction count" to "**number of FINISHED matches**" — the same
   denominator for every participant in the group. `buildLeaderboard` gains a `finishedMatchIds`
   argument (the global FINISHED-match id set). For each participant: `predictionsGraded =
   finishedMatchIds.size`; `totalPoints` = sum of their graded predictions for finished matches
   (a missing pick adds 0); `exactCount`/`outcomeCount` come only from real predictions. Late joiners
   and skippers therefore carry 0s for the matches they have no pick on, against the full denominator.
   `totalPoints` is **unchanged** vs today (0 adds nothing) — only the count/denominator moves.

2. **Frontend card (`FixtureCard.tsx`).** Today the points pill renders only when
   `finished && existing` (line ~339). Broaden it: a **FINISHED** match with a real score but **no
   viewer prediction** renders an explicit `miss`-tinted **"0 pts · no prediction"** pill. A
   not-yet-FINISHED locked card is untouched. This is purely derived on the client (no Firestore
   read/write) and amends ticket 032's "no pill when no pick" rule **for finished cards only**.

The grading pass (`gradeGroupPredictions`) is **unchanged** — only participants' *existing*
predictions are graded; the 0s for missing picks live entirely in the aggregation + the card.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `scripts/ingest/buildLeaderboard.ts` | edit | Add `finishedMatchIds: ReadonlySet<string>` param; add `matchId` to `GradedPrediction`; `predictionsGraded = finishedMatchIds.size`; sum points over finished-match picks; missing ⇒ 0. |
| `scripts/ingest/buildLeaderboard.test.ts` | edit | New cases: late joiner gets 0s for pre-join finished matches; skipper gets 0 + denominator bump; `predictionsGraded == finishedMatchIds.size` for all; `totalPoints` regression-identical; non-participant still excluded; not-yet-finished match excluded. |
| `scripts/ingest/index.ts` | edit | Build `finishedMatchIds` from the FINISHED set (already computed as `finished` map in 033's refactor) and pass it + `matchId` through to `buildLeaderboard`. |
| `src/components/FixtureCard.tsx` | edit | Finished + score + **no** `existing` ⇒ render `PointsPill(points=0, tier='miss', noPrediction)`. |
| `src/components/FixtureCard.test.tsx` | edit | Finished + no prediction ⇒ "0 pts · no prediction" pill present; not-yet-finished locked + no prediction ⇒ pill absent. |
| `src/i18n/en.json`, `src/i18n/es.json` | edit | New key e.g. `predictions.noPredictionZero` ("0 pts · no prediction" / "0 pts · sin pronóstico"); key parity enforced by existing test. |

## Data shapes / interfaces
```ts
// scripts/ingest/buildLeaderboard.ts
export interface GradedPrediction {
  uid: string
  matchId: string            // NEW — to bind a pick to a finished match
  points?: number | null
  breakdown?: ScoreBreakdown | null
}
export function buildLeaderboard(
  predictions: GradedPrediction[],
  participants: ParticipantProfile[],
  finishedMatchIds: ReadonlySet<string>,   // NEW — denominator = its size
): LeaderboardRow[]
// LeaderboardRow shape is unchanged; predictionsGraded now == finishedMatchIds.size for every row.
```
No Firestore document shape changes. `LeaderboardEntry.predictionsGraded` keeps its type; only its
*meaning* widens to "finished matches in the tournament." No phantom `Prediction` docs are written.

## Reused utilities
- `PointsPill` + `Tier`/`bestTier` (`FixtureCard.tsx`) — reuse the existing `miss` tint and pill; add a
  no-prediction label variant. No new card component.
- `buildLeaderboard` dense-rank + tie-break (`compareRows`) — unchanged; tie-break keys still apply
  against the new denominator.
- The FINISHED-match set already assembled in `index.ts` (`finished` map) — reused as `finishedMatchIds`.
- i18n `t()` + en/es parity test — reused for the new copy.

## Test strategy
- **buildLeaderboard.test.ts (pure, node-env):** drives acceptance rules 1–7 with fixed datasets —
  late joiner 0s, skipper 0 + denominator, equal `predictionsGraded == finishedMatchIds.size`,
  `totalPoints` byte-identical to a pre-ticket baseline, non-participant excluded, FINISHED-only gating
  (a not-yet-finished match is not in `finishedMatchIds` ⇒ not counted), and "no phantom docs" (the
  function is pure — it returns rows, writes nothing).
- **FixtureCard.test.tsx (component):** FINISHED + no prediction ⇒ the "0 pts · no prediction" pill is
  rendered (rule 8); a locked-but-not-finished card with no prediction ⇒ pill absent (rule 7).
- **Suite:** `npm run test:ingest`, `npm test`, `npm run build`, `npm run lint`, prettier on touched
  files (rule 9); i18n key-parity test stays green.

## Risks
- **Denominator semantics ripple.** `predictionsGraded` now means "finished matches," so any UI reading
  it shows the new number — intended. Mitigation: confirm `LeaderboardRow.tsx` copy still reads
  naturally ("graded N"); no math depends on the old meaning.
- **`totalPoints` must not move.** A bug that double-counts or drops a pick would shift points.
  Mitigation: rule-4 byte-for-byte regression against the pre-ticket baseline on the sample fixtures.
- **Finished vs locked confusion on the card.** Only `status === 'FINISHED'` with a real score shows
  0 pts; `IN_PLAY`/locked-upcoming must not. Mitigation: gate on the existing `finished` flag +
  `score.home/away !== null`; component test asserts both branches.
- **Interaction with 033.** 033's single-read refactor feeds `buildLeaderboard` from an in-memory set;
  034 only adds an argument + `matchId`. Land 033 first; 034's `index.ts` edit is a small addition to
  that call site.
