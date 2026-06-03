# 003 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Define the Firestore document shapes as TypeScript interfaces in `src/shared/types.ts`, build typed
`FirestoreDataConverter<T>` converters + collection references in `src/firebase/db.ts`, and replace the
deny-all `firestore.rules` with rules enforcing the constitution's two-writers rule, the authoritative
kickoff lock (server `request.time`), allowlist membership, ownership, and a hard ban on clients writing
`points`/`breakdown`. Add the composite indexes the read queries need, and prove every rule with
`@firebase/rules-unit-testing` emulator tests run through `firebase emulators:exec`.

The `ScoringConfig` type is owned by ticket 006 (`src/shared/scoring.ts`) and is imported, never redefined.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/shared/types.ts` | new | Interfaces: User, Team, Score, Match, Prediction, LeaderboardEntry, Standing, config docs. Imports `ScoringConfig` from `../shared/scoring`. |
| `src/firebase/db.ts` | new | `db = getFirestore(app)`; one `FirestoreDataConverter<T>` + typed collection ref per collection. |
| `firestore.rules` | edit | Real rules: read-only public collections, owner users, kickoff-locked owner-only predictions, no points/breakdown tampering, `isMember()` allowlist. |
| `firestore.indexes.json` | edit | matches (status,kickoff), matches (group,kickoff), predictions (uid,matchId). |
| `test/rules/predictions.test.ts` | new | Kickoff lock, ownership, tampering, allowlist, read. |
| `test/rules/results.test.ts` | new | Client write denied on matches/leaderboard/standings/config; reads allowed. |
| `test/rules/users.test.ts` | new | Owner write, isAdmin rejection. |
| `vite.config.ts` | edit | Exclude `test/rules/**` from the default jsdom run. |
| `package.json` | edit | Add `test:rules` script. |
| `firebase.json` | edit | Add firestore emulator port block. |

## Data shapes / interfaces
```ts
// matches/{matchId}  (matchId = football-data id as string)
interface Team { id: number; name: string; shortName: string; tla: string; crest: string }
interface Score { home: number | null; away: number | null }
interface Match {
  matchId: string; kickoff: Timestamp; status: MatchStatus; stage: string;
  group: string | null; homeTeam: Team; awayTeam: Team; score: Score; lastUpdated: Timestamp;
}
// predictions/{uid}_{matchId}
interface Prediction {
  uid: string; matchId: string; homeGoals: number; awayGoals: number;
  createdAt: Timestamp; updatedAt: Timestamp;
  points?: number; breakdown?: ScoreBreakdown;  // written by ingestion only
}
```

## Reused utilities
- `src/firebase/config.ts` — exports the initialized `app`; `db.ts` imports it.
- `src/shared/scoring.ts` (ticket 006, parallel) — source of `ScoringConfig` and the points breakdown shape.

## Test strategy
- `@firebase/rules-unit-testing` against the Firestore emulator via `firebase emulators:exec --only firestore`.
- Seed `matches`/`config` with `withSecurityRulesDisabled` (admin context), then assert allowed/denied
  writes for authed/unauthed/wrong-owner contexts, before and after kickoff, with and without tampering.

## Risks
- Each prediction write does a `get()` on the match doc (kickoff lock) → one extra read per write. Acceptable
  at this scale (≤ a few dozen users × 104 matches); documented in `firestore.rules`.
- `ScoringConfig` import depends on ticket 006 landing `src/shared/scoring.ts`. If absent at build time the
  type-check fails; mitigated by the parallel agent owning that file.
