# 024 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Purely presentational. Three files change, in this order so the Canvas can preview the result first:

1. **`src/dev/FixtureCardPreview.tsx`** (canvas replica) — flip the two team `Stack`s from
   `direction={{ xs: 'column', sm: 'row' | 'row-reverse' }}` to a plain `direction="column"`, and
   simplify its inner `TeamName` `sx` so the centered/wrapping (mobile) behavior applies at every
   breakpoint (drop the `sm` overrides). This is the thing we eyeball on the Canvas.
2. **`src/pages/CanvasPage.tsx`** — delete the 7-option `SCORE_INPUT_OPTIONS.map(...)` comparison and
   instead render the preview twice: once inside a **mobile-width** `Box` (≈400px) and once inside a
   **desktop-width** `Box` (wider, e.g. 560–600px), each labelled, so both widths sit side by side on the
   page. The preview's center stays the production-style Spinner.
3. **`src/components/FixtureCard.tsx`** (production) — apply the identical structural change to its
   `TeamName` and the two team `Stack`s: `direction="column"` always, name above flag, centered/wrapping
   `TeamName` `sx` at all breakpoints. Center slot, caption, countdown/status chip, Save button,
   own-prediction line, reveal entry, snackbar, and all aria/labels are untouched.

Because the preview and the real card share the same little `TeamName`/`TeamFlag`/team-`Stack` shape,
the diff is the same edit applied in both places. No hook, type, route, or i18n change.

### The exact structural edit (applies to both FixtureCard and FixtureCardPreview)
Today (home side; away side is the mirror with `row-reverse`):
```tsx
<Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 1 }}
  sx={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: { sm: 'flex-end' } }}>
  <TeamName team={homeTeam} align="right" />
  <TeamFlag team={homeTeam} />
</Stack>
```
After — name always above flag, column at all widths, contents centered:
```tsx
<Stack direction="column" spacing={0.5}
  sx={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}>
  <TeamName team={homeTeam} />
  <TeamFlag team={homeTeam} />
</Stack>
```
The away `Stack` becomes the same `direction="column"` (no more `row-reverse`); name stays DOM-before
flag for both teams. The `align` prop on `TeamName` is no longer needed (everything is centered) — drop
it from the prop type and both call sites.

`TeamName` `sx` is simplified to the single always-centered/wrapping form (removing the `sm` overrides
that only served the inline row):
```tsx
sx={{
  width: '100%',
  minWidth: 0,
  textAlign: 'center',
  fontWeight: 600,
  lineHeight: 1.15,
  color: tbd ? 'text.secondary' : 'text.primary',
  whiteSpace: 'normal',   // wrap the full country name on its own line(s)
}}
```
`title={name}` stays (accessibility / hover). The `variant="body2"` stays. `TeamFlag` is unchanged.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/dev/FixtureCardPreview.tsx` | edit | Team `Stack`s → `direction="column"`; `TeamName` `sx` → always centered/wrapping; drop `align` prop. Canvas-only replica, edited first. |
| `src/pages/CanvasPage.tsx` | edit | Remove `SCORE_INPUT_OPTIONS.map` grid + its imports; render `FixtureCardPreview` in a ~400px mobile `Box` and a wider desktop `Box`, each labelled. Center = production-style Spinner. |
| `src/components/FixtureCard.tsx` | edit | Same structural edit to `TeamName` + the two team `Stack`s. No other behavior touched. |
| `src/components/FixtureCard.test.tsx` | edit | Add a DOM-order assertion (name precedes flag, both teams) + that the team wrapper is a column; keep all existing assertions green. |
| `src/dev/scoreInputs.tsx` | maybe delete | Imported ONLY by `CanvasPage` (verified). After the Canvas drops the grid it is unused → delete to avoid dead code. Re-verify usages at implement time. |

## Data shapes / interfaces
No type, Firestore, route, or i18n changes. The only signature touched is the local `TeamName` helper
(internal to each file), which loses its `align` prop:
```ts
// before
function TeamName({ team, align }: { team: Team; align: 'left' | 'right' }): JSX.Element
// after
function TeamName({ team }: { team: Team }): JSX.Element
```
`FixtureCardProps`, `Match`, `Prediction`, `useSavePrediction`, etc. are unchanged.

## Reused utilities
- `useTeamName()` (`src/i18n/useTeamName`), `isTbdTeam()` (`src/hooks/matchGrouping`) — unchanged, still
  used by `TeamName`/`TeamFlag`.
- `FixtureCardPreview` + `sampleScheduledMatch` (`src/dev/sampleData`) — reused by the new Canvas; the
  Spinner-style center already lives in the preview.
- Existing `FixtureCard` wiring (`useSavePrediction`, `CountdownToKickoff`, `MatchPredictionsDialog`,
  `effectiveMode`/`lockTimeMs`) — reused verbatim, not modified.

## Test strategy
- **AC1 (FixtureCard layout):** extend `src/components/FixtureCard.test.tsx` — render an upcoming card and
  assert the home team's name node appears **before** its flag/avatar in DOM order, same for away, and
  that the team wrapper `Stack` carries `flex-direction: column` (no `row`). Existing tests (steppers,
  save ref/shape, kickoff-disable, finished score, reveal dialog, strict tooltip) must stay green —
  they're layout-agnostic, so no breakage expected.
- **AC2 (preview in sync):** inspection/diff that `FixtureCardPreview`'s team `Stack`s are
  `direction="column"` matching FixtureCard. (No preview test exists; optional lightweight render check
  only if cheap.)
- **AC3 (Canvas cleaned):** grep/diff that `CanvasPage` no longer references `SCORE_INPUT_OPTIONS` and now
  renders two width-bounded `FixtureCardPreview`s. The dev sandbox has no test harness — verify by build +
  grep.
- **AC4 (nothing else changed):** `git diff --name-only` shows only the files above; `useSavePrediction`,
  `firestore.rules`, `scripts/ingest/*`, scoring, reveal, and `en.json`/`es.json` untouched. `npm run
  test:rules`, `npm run test:ingest`, and the i18n key-parity test stay green.
- **AC5 (a11y):** existing/added assertions confirm the Card `aria-label` "Home versus Away" and the team
  `title` attributes still resolve.
- **AC6 (gates):** `npm run build`, `npm test`, `npm run lint`, `npx prettier --check .`.

## Risks
- **Long country names wrapping to 2–3 lines** make cards uneven in height → mitigation: this is the
  intended look (owner asked for stacked); the Canvas mobile+desktop preview exists precisely to confirm
  it's acceptable before shipping. If too tall, a follow-up can cap with `maxWidth`/line-clamp — out of
  scope here.
- **Deleting `scoreInputs.tsx`** could break an unseen import → mitigation: re-run the grep at implement
  time; only delete if `CanvasPage` is the sole importer (currently true).
- **Desktop horizontal space** now under-used (flags no longer fill the row) → acceptable; the centered
  column is the requested design. No functional impact.
