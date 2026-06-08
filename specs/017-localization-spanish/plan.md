# 017 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Add **i18next + react-i18next + i18next-browser-languagedetector**, initialized once and imported
for its side effects in `src/main.tsx` (before `<App/>`). Translation resources are **bundled JSON**
(`en`/`es`) imported statically, so init is **synchronous** — no Suspense, no HTTP backend, no flash of
keys. Detection order `['localStorage', 'navigator']` with `caches: ['localStorage']`,
`supportedLngs: ['en','es']`, `fallbackLng: 'en'`, `load: 'languageOnly'` (so `es-CO` → `es`). A tiny
`LanguageSwitcher` (EN/ES) in the AppShell top bar + on the Login page lets users override; the choice
persists in localStorage and wins over browser detection next load. An i18next `languageChanged` handler
keeps `document.documentElement.lang` in sync (and sets it once at init).

Then every user-facing string in the React app is replaced with `t('namespace.key')` (or `<Trans>` for
embedded markup), with natural Colombian-Spanish translations. Resources are organized by namespace-ish
key prefixes in one default bundle: `common`, `nav`, `auth`, `groups`, `fixtures`, `predictions`,
`leaderboard`, `standings`, `admin`, `members`, `errors`, `states`. Interpolation/plural handled by
i18next (`{{count}}`, `_one/_other`) for "N min ago", countdown units, "{n} members", etc.

The superadmin-only **Canvas** sandbox and **MatchLabCard** are explicitly NOT translated (internal
tooling — non-goal). Data from Firestore (team names, etc.) is never translated.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `package.json` | edit | deps: `i18next`, `react-i18next`, `i18next-browser-languagedetector` |
| `src/i18n/index.ts` | new | i18next init + config (detection, fallback, html-lang sync, `useSuspense:false`) |
| `src/i18n/locales/en.json` | new | English bundle (source of truth for keys) |
| `src/i18n/locales/es.json` | new | Spanish bundle (same key set; natural fútbol Spanish) |
| `src/i18n/locales.test.ts` | new | **key-parity** test: deep key-set(en) === key-set(es) |
| `src/components/LanguageSwitcher.tsx` | new | compact EN/ES toggle → `i18n.changeLanguage`, persists |
| `src/main.tsx` | edit | `import './i18n'` (side-effect init) before render |
| `src/test/setup.ts` | edit | initialize i18n with `lng:'en'` so tests render English deterministically |
| `index.html` | edit (minor) | leave `lang="en"`; i18n overwrites at runtime |
| `src/components/AppShell.tsx` | edit | add `<LanguageSwitcher/>` to the toolbar; title via `t()` where literal |
| `src/components/navItems.tsx` | edit | nav labels via `t('nav.*')` — labels become a function of `t` (see below) |
| `src/pages/LoginPage.tsx` | edit | strings + a `<LanguageSwitcher/>` (AppShell isn't mounted when signed out) |
| `src/pages/MyGroupsPage.tsx`, `CreateGroupPage.tsx`, `JoinGroupPage.tsx`, `MembershipGate.tsx` | edit | groups/auth strings |
| `src/pages/FixturesPage.tsx`, `PredictionsPage.tsx`, `LeaderboardPage.tsx`, `StandingsPage.tsx`, `AdminPage.tsx`, `SuperadminPage.tsx` | edit | feature strings |
| `src/components/MatchCard.tsx`, `PredictionCard.tsx`, `PredictionInput.tsx`, `MatchTeams.tsx`, `MatchPredictionsDialog.tsx`, `CountdownToKickoff.tsx`, `LeaderboardRow.tsx`, `states/{Empty,Error,Loading}State.tsx` | edit | shared-component strings (TBD, statuses, stage labels, snackbars, aria) |
| existing `*.test.tsx` asserting English literals | edit as needed | keep asserting the (still-English) default render; no key strings leak |

## Data shapes / interfaces
```ts
// src/i18n/index.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import es from './locales/es.json'

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  supportedLngs: ['en', 'es'],
  fallbackLng: 'en',
  load: 'languageOnly',
  detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  interpolation: { escapeValue: false }, // React already escapes
  react: { useSuspense: false },
})
const setHtmlLang = (lng: string) => { document.documentElement.lang = lng }
setHtmlLang(i18n.resolvedLanguage ?? 'en')
i18n.on('languageChanged', setHtmlLang)
export default i18n

// nav labels: navItems must be derived from t() (icons stay static). Convert
// DEFAULT_NAV_ITEMS to a `useNavItems()` hook OR a `navItems(t)` factory consumed in GroupApp.
```
Translation key example (en / es):
```json
// en: { "nav": { "fixtures": "Fixtures", "predictions": "Predictions", "leaderboard": "Leaderboard", "standings": "Standings" },
//        "fixtures": { "title": "Fixtures", "updated": "Updated {{when}}", "empty": "No fixtures yet" },
//        "predictions": { "yours": "Your predictions", "save": "Save prediction", "update": "Update prediction" } }
// es: { "nav": { "fixtures": "Partidos", "predictions": "Predicciones", "leaderboard": "Tabla", "standings": "Grupos" },
//        "predictions": { "save": "Guardar predicción", "update": "Actualizar predicción" } }
```

## Reused utilities
- All MUI components/theme unchanged — i18n only swaps the text children/props.
- `dayjs` already used for times; **nice-to-have** (not gated): `import 'dayjs/locale/es'` + `dayjs.locale()`
  synced to the active language for localized month names. Keep numeric `HH:mm`/`MMM D` if simpler.
- Existing `relativeFromNow`, `stageLabel`, `statusChip` become `t()`-backed (pass labels through keys).

## Test strategy
- **AC1 (detect/fallback):** unit test i18n config — `es-CO` resolves to `es`; unsupported → `en`.
- **AC3 (key parity):** `src/i18n/locales.test.ts` flattens both bundles and asserts identical key sets.
- **AC2 (no hard-coded strings):** planner/impl adds a grep check in the verify step
  (e.g. ripgrep for telltale literals in the wrapped files) — documented, not a runtime test.
- **AC4 (switcher persists):** test `LanguageSwitcher` calls `changeLanguage` and writes localStorage.
- **AC5 (`<html lang>`):** test that `languageChanged` sets `document.documentElement.lang`.
- **AC6 (gates):** test setup inits i18n to `en`, so all existing `getByText('English…')` assertions keep
  passing; run `npm run build/test/lint/prettier`. Update any test that asserted a moved/renamed literal.
- **AC7 (no backbone change):** `firestore.rules`, scoring, ingestion untouched — diff + suites unchanged.

## Risks
- **Tests rendering keys instead of text** → init i18n synchronously in `src/test/setup.ts` with `lng:'en'`
  and bundled resources; `useSuspense:false` so components render immediately.
- **Missing/!drifting keys** → key-parity test (AC3) fails the build if `es` and `en` diverge.
- **Nav labels are module-level constants** → refactor to a `navItems(t)` factory / `useNavItems()` hook so
  labels re-evaluate on language change (GroupApp already builds the array each render).
- **Pluralization** (e.g. "1 member" / "2 members", "day"/"days") → use i18next `count` plurals, not manual
  string concatenation.
- **Scope creep into Canvas** → MatchLabCard/CanvasPage deliberately excluded (non-goal).
