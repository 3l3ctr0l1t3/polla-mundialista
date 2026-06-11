# 032 — Tasks

- [x] 1. Refactor FixtureCard into top · center(84) · fixed footer zones; move own-pick + no-pick
       captions into the center slot.
- [x] 2. Port the option-C pill (dot + "N pts", success/warning/error tint) — ingestion points
       preferred, shared-engine fallback; render only on finished+predicted.
- [x] 3. Finished card: remove the button from the footer; whole-card accessible click opens the
       dialog; locked/live keep the button.
- [x] 4. i18n keys (en + es).
- [x] 5. Tests per spec rules 1–5; full suite green.
- [x] 6. Gates + backlog row 032 ✅; commit; push (auto-deploy); watch the run.

## Verification command(s)
```
npm test && npm run build && npm run lint
```
