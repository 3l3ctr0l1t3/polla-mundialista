# 024 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. **Canvas replica first.** In `src/dev/FixtureCardPreview.tsx`: change both team `Stack`s to
      `direction="column"` (drop the `{ xs: 'column', sm: 'row' | 'row-reverse' }`), set their spacing/
      `justifyContent` to the centered column form; simplify `TeamName` `sx` to the always-centered/
      wrapping version and drop the `align` prop from `TeamName` + both call sites. Name stays DOM-before
      flag.
- [x] 2. **Repurpose the Canvas.** In `src/pages/CanvasPage.tsx`: remove the `SCORE_INPUT_OPTIONS.map(...)`
      grid and the `scoreInputs` import; render `FixtureCardPreview` (sampleScheduledMatch, Spinner-style
      center) inside two labelled, fixed-width `Box`es — a ~400px **mobile** container and a wider
      **desktop** container — so both widths can be compared. Keep the superadmin/dev-only framing + Alert.
- [x] 3. **Preview checkpoint.** `npm run dev`, open the Canvas (superadmin/local-dev), eyeball the stacked
      name-above-flag layout at mobile + desktop widths; confirm with the owner before touching production.
- [x] 4. **Production card.** In `src/components/FixtureCard.tsx`: apply the identical structural edit —
      both team `Stack`s `direction="column"`, centered; `TeamName` `sx` always-centered/wrapping; drop the
      `align` prop + its `'left' | 'right'` type. Leave the center slot, caption, countdown/status chip,
      Save button, own-prediction line, reveal entry, snackbar, and all aria/labels untouched.
- [x] 5. **Delete dead code.** Re-grep for importers of `src/dev/scoreInputs.tsx`; if `CanvasPage` was the
      only one (expected), delete `src/dev/scoreInputs.tsx`.
- [x] 6. **Tests for the acceptance rules.** In `src/components/FixtureCard.test.tsx`: add an assertion that
      the team name node precedes the flag/avatar in DOM order (both teams) and that the team wrapper is a
      column (not a horizontal row). Keep all existing assertions (steppers, save ref/shape, kickoff-
      disable, finished score, reveal dialog, strict tooltip) green; confirm the Card `aria-label` "versus"
      and team `title`s still resolve (AC5).
- [x] 7. **Run the quality gates:** `npm run build`, `npm test`, `npm run lint`, `npx prettier --check .`.
      Confirm `git diff --name-only` lists only the 024 files (no scoring/rules/ingest/i18n changes — AC4).
- [x] 8. Run `/spec-verify 024` and confirm all acceptance rules pass.
- [x] 9. Update `specs/backlog.md` status to ✅ (or 🟨 if a live preview check is still pending).

## Verification command(s)
```
npm run build
npm test
npm run lint
npx prettier --check .
git diff --name-only        # expect only: src/components/FixtureCard.tsx, src/components/FixtureCard.test.tsx,
                            #               src/dev/FixtureCardPreview.tsx, src/pages/CanvasPage.tsx,
                            #               (deleted) src/dev/scoreInputs.tsx, specs/024-*, specs/backlog.md
# Unchanged & still green (AC4):
npm run test:rules
npm run test:ingest
```
