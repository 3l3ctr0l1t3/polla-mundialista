# 032 — Plan

## Approach
Refactor `FixtureCard` into three fixed zones (top · center-84px · footer-fixed) and port the
Canvas option-C pill (`src/dev/FinishedCardPreviews.tsx` `VariantC`/`Dot`/`tierColor`) into the
real card. Tier/points: `existing.points`/`breakdown` (ingestion) when defined, else
`scorePrediction(pred, score, effectiveScoring(group ?? {}), match.stage)`. Finished card gets an
accessible full-card click (opens the existing dialog) instead of the button.

## Files
| Path | Change |
|------|--------|
| `src/components/FixtureCard.tsx` | three-zone layout, pill, finished-card click |
| `src/components/FixtureCard.test.tsx` | update finished-state tests; add pill/tier/source/size-structure tests |
| `src/i18n/locales/en.json` / `es.json` | pill aria + finished-card click label (reuse `predictions.pts`) |

## Reused utilities
- `scorePrediction`, `effectiveScoring`, `DEFAULT_SCORING` (src/shared/scoring.ts — the ONE engine)
- `useGroup` (already in the card) for the group's scoring override
- `predictions.pts` i18n key (dialog chip) for the pill text

## Test strategy
- Footer zone present in all six states (rule 1); pill text/tier classes for exact/outcome/miss
  (rule 2, incl. ingestion-points preferred over computed); absent otherwise (rule 3); finished
  card click opens dialog while locked/live keep the button (rule 4); captions inside center slot
  (rule 5). Existing 027/031 tests updated only where the finished-state button assertion changes.

## Risks
- 027's verified rule said "finished unchanged" — superseded explicitly by this spec (court of
  record: the user picked the canvas design without the button).
- jsdom can't measure pixels → size constancy asserted structurally (zones present, no extra rows).
