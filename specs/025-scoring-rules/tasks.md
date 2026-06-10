# 025 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

### Slice 1 — Engine (shared, pure) — ingestion-engineer
- [x] 1. In `src/shared/scoring.ts`: add `roundBonus: Record<string, number>` to `ScoringConfig` and
      `roundBonus: number` to `ScoreBreakdown`; add the default round-bonus map to `DEFAULT_SCORING`
      (`GROUP_STAGE 0, LAST_32 0, LAST_16 1, QUARTER_FINALS 2, SEMI_FINALS 3, FINAL 4, THIRD_PLACE 3`).
- [x] 2. Extend `scorePrediction(pred, actual, cfg?, stage?)`: compute base as today, then if base `> 0`
      and `stage` is given, set `breakdown.roundBonus = cfg.roundBonus[stage] ?? 0`; `points` = sum of all
      breakdown fields. Keep it pure (no Date/IO/dep; stage is a plain string).
- [x] 3. Add `mergeScoring(base, override?)` (nested-merge `roundBonus`) and `effectiveScoring(group)` =
      `mergeScoring(DEFAULT_SCORING, group.scoring)`, both pure, exported.
- [x] 4. Extend `src/shared/scoring.test.ts`: exact FINAL=10, exact GROUP_STAGE=6, outcome-only LAST_16=4,
      QUARTER_FINALS outcome+GD=6, LAST_32=base, wrong=0; a `FINAL` bonus-10 override changes the result;
      assert `points === exact+outcome+goalDiff+roundBonus`; purity unchanged. (AC1, AC2)

### Slice 2 — Security rules — firestore-rules-engineer
- [x] 5. In `firestore.rules`, add helpers near the ticket-019 block: `scoringChanged()`,
      `validScoring()` (expected keys present; `exact`/`outcome`/`goalDiffBonus` and every
      `roundBonus[stage]` are integers `>= 0`; `goalDiffOnlyOnCorrectOutcome` is bool; `gradeOn ==
      'fullTime90'`; the 7 stage keys present), and `onlyModeOrScoringChanged()`.
- [x] 6. Tighten the `match /groups/{gid}` update rule: owner/admin may set/update `scoring` ONLY when
      `modeChangeable()` (before `firstCupMatchKickoff − 10min`) AND `validScoring()`; deny at/after freeze
      and on bad shape; a non-owner admin may change `mode` and/or `scoring` (gated), nothing else. Leave
      the `mode` behavior unchanged.
- [x] 7. Add Firestore emulator tests (`test/rules/…`): admin valid scoring write pre-freeze ✓; at/after
      freeze ✗; malformed (negative / non-integer / missing key / extra key) ✗; non-admin member ✗;
      existing `mode` + membership invariants still pass. (AC3)

### Slice 3 — Ingestion grading + leaderboard aggregation — ingestion-engineer
- [x] 8. `scripts/ingest/scoring.ts`: re-export `effectiveScoring`/`mergeScoring` (+ existing exports) from
      the shared engine (single source of truth — no reimplementation).
- [x] 9. `scripts/ingest/index.ts`: extend the `finished` map value with `stage`; compute each group's
      effective config (`mergeScoring(globalBase, group.scoring)`); pass the match `stage` into
      `scorePrediction`; bump `SCORING_VERSION` 1→2.
- [x] 10. `scripts/ingest/index.ts` `resolveGroupContext`: read each member's `requestedAt` and the group's
      `createdAt` (owner) → `ParticipantProfile.joinedAtMs`; thread it through to the board write.
- [x] 11. `scripts/ingest/buildLeaderboard.ts`: add `joinedAtMs` to `ParticipantProfile` + `LeaderboardRow`;
      `compareRows` final key = `joinedAtMs ASC` (replacing `displayName`); persist `joinedAt` on the row.
- [x] 12. Extend `scripts/ingest/buildLeaderboard.test.ts` (crafted tie → `points → exact → outcome →
      earliest joinedAt`) and the grading path test (per-group `scoring` override + `stage` → integer
      points incl. bonus, `SCORING_VERSION` bumped, exact/outcome counts). (AC4, AC5-server)

### Slice 4 — Types + leaderboard client sort — react-mui-builder
- [x] 13. `src/shared/types.ts`: `Group` gains optional `scoring?: ScoringConfig`; `LeaderboardEntry` gains
      `joinedAt` (Timestamp). Verify the `db.ts` converters pass the new fields through.
- [x] 14. `src/hooks/useGroupRoster.ts` (+ its test): final tie-break uses the entry's `joinedAt` (not
      `displayName`), ranking identically to the server. (AC5-client)

### Slice 5 — Admin editor + explainer + i18n — react-mui-builder
- [x] 15. `src/pages/AdminPage.tsx`: add an admin-only **Scoring** section — number inputs for base tiers +
      the 7 round bonuses, prefilled via `effectiveScoring(group)`, saved with the FULL object via
      `updateDoc(groupDoc(gid), { scoring })`, `disabled` when `frozen` (reuse existing `frozen` + frozen
      hint). (AC6)
- [x] 16. `src/components/ScoringExplainer.tsx` (new): localized "How points work" dialog/section reading
      `effectiveScoring(group)` — base tiers, per-round bonuses, tie-break order; add its entry point from
      `src/pages/LeaderboardPage.tsx`. (AC7)
- [x] 17. Add all new copy keys (`admin.scoring*`, `scoring.*`) to BOTH `src/i18n/locales/en.json` and
      `es.json`; keep the i18n key-parity test green. (AC7)
- [x] 18. Component tests: AdminPage scoring editor (prefill, `updateDoc` ref/shape, frozen-disabled) and
      a ScoringExplainer render test.

### Wrap-up
- [x] 19. Run the gates: `npm run build`, `npm test`, `npm run lint`, `npx prettier --check` (touched
      files), `npm run test:rules`, `npm run test:ingest`. (AC8)
- [x] 20. Run `/spec-verify 025` and confirm all acceptance rules pass.
- [x] 21. Update `specs/backlog.md` status to ✅ (or 🟨 if a live click-test is still pending).

## Verification command(s)
```
npm run build
npm test            # engine + leaderboard client + admin/explainer + i18n parity
npm run test:ingest # per-group config grading + join-time tie-break (server)
npm run test:rules  # scoring-config write: pre/post-freeze, bad shape, non-admin
npm run lint
npx prettier --check src/shared/scoring.ts src/shared/types.ts src/pages/AdminPage.tsx src/components/ScoringExplainer.tsx src/hooks/useGroupRoster.ts scripts/ingest/index.ts scripts/ingest/buildLeaderboard.ts
```
