# 017 — Localization (i18n) with Spanish + browser detection

> Status: 🟦 spec ready · Depends on: 009 · Specialist: react-mui-builder

## Why
The audience is Colombian — most users speak Spanish — but the app is currently English-only with display
strings hard-coded inside React components. This ticket adds internationalization (i18n) with **English (en)**
and **Spanish (es)**, where the active language is **auto-detected from the browser** (a Spanish browser opens
in Spanish) with a persisted manual override, and moves **every** user-facing string into translatable
resource bundles so no hard-coded display copy remains in components.

## User story
As a **Spanish-speaking participant**, I want **the app to open in Spanish automatically (with an option to
switch to English) and have all UI text translated naturally** so that **I can use the polla in my own
language without friction**.

## Scope
- **Chosen tech (decided):** `react-i18next` + `i18next` + `i18next-browser-languagedetector` — standard,
  lightweight, client-side, and free (fits the free-tier constitution; no backend or paid dependency). The
  planner confirms exact versions/config wiring.
- **`src/i18n/` module:** i18next init + config + the `en` and `es` resource bundles (JSON). Initialized
  **once** and provided app-wide (in `src/main.tsx`). Config:
  - **Detection order:** `localStorage` → `navigator` (a stored manual choice wins over the browser).
  - **`supportedLngs: ['en','es']`**, **`fallbackLng: 'en'`** (English for any unsupported language).
  - **Persisted to `localStorage`** so a manual choice sticks across reloads.
  - Sets **`<html lang>`** to the active language and updates it when the language changes.
- **Keys organized by feature/namespace** for maintainability, e.g. `common`, `auth`, `groups`, `fixtures`,
  `predictions`, `leaderboard`, `standings`, `admin`, `errors`.
- **Replace EVERY user-facing hard-coded string** in the React app with a translation key via `t()` / the
  `<Trans>` component, across:
  - **Pages:** Login, MyGroups, CreateGroup, JoinGroup, Fixtures, Predictions, Leaderboard, Standings, Admin,
    Superadmin, MembershipGate.
  - **Shared components:** AppShell, `navItems` labels, MatchCard, PredictionCard, PredictionInput, MatchTeams
    ("TBD"), MatchPredictionsDialog, CountdownToKickoff, LeaderboardRow, the Loading/Empty/Error states, and
    user-visible snackbars / `aria-label`s.
- **Natural Spanish translations** for a Colombian football audience (not machine-literal), e.g.
  "Fixtures" → "Partidos", "Leaderboard" → "Tabla de posiciones", "Predictions" → "Predicciones",
  "Standings" → "Grupos" / "Posiciones", "Sign in with Google" → "Iniciar sesión con Google",
  "Your prediction" → "Tu predicción".
- **Interpolation & pluralization** handled where needed (e.g. "N min ago", countdown units, "{n} members")
  using i18next interpolation + plural forms (`_one` / `_other`) for both languages.
- **Dates/times:** dayjs already formats times; loading the dayjs **`es`** locale for locale-aware month names
  is a nice-to-have — the planner decides whether to load it or keep numeric formats. (Not a blocking
  acceptance rule.)
- **Language switcher:** a small, unobtrusive **EN/ES** control (e.g. in the AppShell top bar) that calls
  `i18n.changeLanguage`, updates the UI immediately, and persists the choice to `localStorage`. The default
  still comes from browser detection.

## Non-goals
- Languages beyond **en** and **es**.
- Translating the superadmin-only **Canvas** design sandbox or the **`MatchLabCard`** lab component — internal
  tooling; English is fine there.
- Translating server/ingestion logs, code comments, or anything under `specs/`.
- **Right-to-left (RTL)** layout / bidi support.
- **Per-group** language settings (language is per-user/browser, not per pool).
- Translating **data from Firestore** — team names, group letters, and other football-data content stay
  as-ingested.
- Any change to scoring, ingestion, `firestore.rules`, the two-writers behavior, or the kickoff lock.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. **Browser auto-detect + fallback.** With the browser language set to Spanish (`es` / `es-CO`) and no stored
   override, the app renders in **Spanish on first load** with no manual action. With English (or any
   unsupported language) and no override, it renders in **English** (fallback `en`). Verifiable by setting
   `navigator.language` / clearing `localStorage` in a test or browser check.
2. **No hard-coded display strings.** No user-facing component contains a hard-coded display string; all such
   copy comes from the `en`/`es` bundles via `t()` / `<Trans>`. Verifiable by inspection plus a grep/ESLint
   check the planner defines (e.g. flag literal JSX text in the in-scope component set), excluding the
   Non-goal components.
3. **Key parity.** The `en` and `es` bundles contain the **same set of keys** (no missing translations in
   either language). A check/test proves key parity (deep key-set equality across all namespaces).
4. **Switcher works & persists.** The language switcher changes the UI language **immediately** and the choice
   **persists across reloads** (stored in `localStorage`, and on the next load the stored language is applied
   over browser detection). Verifiable by a test/browser check.
5. **`<html lang>` reflects the language.** The document `<html lang>` attribute equals the active language
   (`en` or `es`) on load and updates when the language changes. Verifiable by reading
   `document.documentElement.lang`.
6. **Quality gates stay green.** `npm run build` (type-check + build), `npm test`, `npm run lint`, and
   `npx prettier --check .` all pass. Existing tests that asserted English literals are updated to assert via
   keys or via the default-English render so they remain meaningful; **the existing 113 tests still pass** (or
   are updated to remain meaningful under i18n).
7. **No behavior change to the integrity backbone.** No change to the scoring engine, ingestion job,
   `firestore.rules`, or the two-writers behavior — this ticket is purely presentational. Verifiable by diff
   (those files/dirs are untouched) and by the rules/ingest test suites still passing unchanged.

## Constitution links
- **Free-tier only (Principle 6):** `react-i18next` / `i18next` / `i18next-browser-languagedetector` are
  client-side libraries shipped in the existing web bundle — no Cloud Functions, no backend, no paid
  dependency.
- **Spec-first (Principle 1):** behavior is specified here before any code.
- **Two-writers rule (Principle 3) & Authoritative kickoff lock (Principle 4):** explicitly **unaffected** —
  this ticket adds no Firestore writes and changes no rules; locking remains enforced by server time
  (acceptance rule 7).
- **No secrets (Principle 5):** n/a — no keys or secrets are introduced; only public UI copy.
- **Done = tested + meets acceptance rules (Principle 7):** key-parity and render-language checks plus the
  quality gates are the automated proof; the existing test suite must stay green.

## Notes / open questions
- **Assumption — detection order:** `localStorage` → `navigator`, so a manual override always beats the
  browser default. If the planner adds `htmlTag`/`querystring` detectors, `localStorage` must stay highest so
  rule 4 holds.
- **Assumption — `es-CO` maps to `es`:** region variants (`es-CO`, `es-MX`, `en-US`, …) resolve to the base
  language via `supportedLngs` + `nonExplicitSupportedLngs`/`load: 'languageOnly'`; the planner confirms the
  exact i18next option used.
- **Assumption — namespaces vs. flat keys:** keys are grouped by feature (listed in Scope). The planner may
  implement these as i18next **namespaces** or as nested keys under a single namespace, as long as key parity
  (rule 3) is checkable; whichever is chosen is documented in `plan.md`.
- **Assumption — switcher placement:** the AppShell top bar is the suggested home for the EN/ES control; the
  planner may place it elsewhere (e.g. a settings menu) consistent with `src/theme/`, as long as it is
  unobtrusive and meets rule 4.
- **dayjs `es` locale** is a nice-to-have, not gated by an acceptance rule; the planner decides whether to load
  it for localized month names or keep numeric date formats.
- **No-hard-coded-strings check (rule 2):** the planner defines the concrete mechanism (an ESLint rule such as
  `i18next/no-literal-string` scoped to the in-scope components, or a grep-based test), and documents the
  Non-goal exclusions (Canvas, `MatchLabCard`).
