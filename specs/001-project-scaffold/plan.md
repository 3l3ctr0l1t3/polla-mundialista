# 001 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.
> Specialist: react-mui-builder.

## Approach
Stand up a Vite + React + TypeScript (strict) app **at the repo root**, layered with MUI (Material Design 3
via Emotion) and the Firebase Web SDK, plus Vitest/ESLint/Prettier. The repo already contains tracked files
(`specs/`, `.claude/`, `CLAUDE.md`, `.gitignore`), so we must **not** let the Vite scaffolder clobber them:
scaffold into a temp dir and merge, then hand-merge `.gitignore`. Firebase is initialized from `VITE_*` env
vars only — no secrets in the bundle. Hosting/Firestore config files are created as minimal, **locked-down**
placeholders; the real security rules are ticket 003's job, and full MD3 theming is ticket 009's. The
deliverable is a deployable empty shell that builds, tests, lints, and publishes to a `*.web.app` URL.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `package.json` | new | scripts: `dev`, `build`, `preview`, `test`, `lint`, `format`; deps below |
| `vite.config.ts` | new | `@vitejs/plugin-react`; Vitest `test` block (`environment: 'jsdom'`, `globals`) |
| `tsconfig.json`, `tsconfig.node.json` | new | `strict: true`, bundler resolution |
| `index.html` | new | Vite entry, `#root`, title "Polla Mundialista" |
| `src/main.tsx` | new | mounts `<App/>` inside `ThemeProvider` + `CssBaseline` |
| `src/App.tsx` | new | minimal shell: app bar + "Polla Mundialista" placeholder card |
| `src/theme/theme.ts` | new | minimal `createTheme` (MD3 seed) — **expanded in ticket 009** |
| `src/firebase/config.ts` | new | `initializeApp` from `import.meta.env.VITE_FIREBASE_*`; exports `app` |
| `src/vite-env.d.ts` | new | `ImportMetaEnv` typing for the `VITE_FIREBASE_*` keys |
| `src/App.test.tsx` | new | sample test: renders App, asserts title — satisfies "test runs & passes" |
| `.env.example` | new | placeholder `VITE_FIREBASE_*` keys (committed) |
| `.eslintrc.cjs` / `eslint.config.js` | new | TS + react-hooks + `eslint-config-prettier` |
| `.prettierrc.json` | new | shared formatting config |
| `firebase.json` | new | hosting `public: dist`, SPA rewrite to `/index.html`; rules + indexes wiring |
| `.firebaserc` | new | project alias — **placeholder `<your-project-id>`**, set during deploy |
| `firestore.rules` | new | locked-down placeholder (`allow read, write: if false;`) — **owned by ticket 003** |
| `firestore.indexes.json` | new | `{ "indexes": [], "fieldOverrides": [] }` |
| `.gitignore` | edit | merge any Vite-suggested entries into the existing file (don't overwrite) |

## Data shapes / interfaces
```ts
// src/vite-env.d.ts — env contract (public Firebase web config only; NOT secrets)
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

// src/firebase/config.ts
import { initializeApp, type FirebaseApp } from 'firebase/app';
export const app: FirebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
```

Dependencies: `react`, `react-dom`, `@mui/material`, `@mui/icons-material`, `@emotion/react`,
`@emotion/styled`, `firebase`. Dev: `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`,
`@testing-library/react`, `@testing-library/jest-dom`, `eslint`, `prettier`, `eslint-config-prettier`,
`typescript-eslint`, `eslint-plugin-react-hooks`.

## Reused utilities
- None yet (greenfield). This ticket **creates** the shared anchors later tickets reuse: `src/firebase/config.ts`
  (SDK init), `src/theme/` (tokens, per CLAUDE.md), and the folder map in `CLAUDE.md`. Do not duplicate these.
- Respect the existing `.gitignore` (already covers `.env*`, `*serviceAccount*.json`) — merge, never replace.

## Test strategy
Map each acceptance rule to a check the verifier can run:
1. **Build** → `npm run build` exits 0 and emits `dist/` (tsc strict + vite build).
2. **Dev + test** → `npm run dev` boots; `npm test` (Vitest) runs the sample `App.test.tsx` green.
3. **Env wiring / no secrets** → grep shows Firebase config reads only `import.meta.env.VITE_*`; no literal keys
   in source; `git check-ignore .env.local` confirms it's ignored; `.env.example` committed with placeholders.
4. **Deploy** → `firebase deploy --only hosting` publishes to a `*.web.app` URL (manual: needs `firebase login`
   + a real project id in `.firebaserc`).
5. **Lint/format** → `npm run lint` and `npx prettier --check .` pass clean.

## Risks
- **Scaffolder clobbering tracked files** → scaffold into a temp dir and move files in; hand-merge `.gitignore`;
  `git status` before committing to confirm `specs/` and `.claude/` are untouched.
- **Deploy needs out-of-band setup** (Firebase project on Spark, `firebase login`, Auth+Firestore enabled,
  real project id) → treat rule 4 as a guided manual step; the verifier may mark it "manual-confirmed".
- **MUI/Emotion peer-dep mismatch or Node version** → pin compatible MUI v6 + Emotion; require Node 20+.
- **Locked-down `firestore.rules` placeholder** is intentional (deny-all) so the DB is never open before
  ticket 003 replaces it — don't relax it here.
- **Secret-guard hook** will block committing any `.env*`/service-account file — expected; keep real values in
  `.env.local` (ignored) and GitHub Secrets.
