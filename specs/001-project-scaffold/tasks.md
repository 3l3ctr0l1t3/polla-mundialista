# 001 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.
> Specialist: react-mui-builder.

## Scaffold & dependencies
- [x] 1. Scaffold Vite React-TS into a temp dir (`npm create vite@latest .tmp-vite -- --template react-ts`),
      then move generated files to repo root **without** touching `specs/`, `.claude/`, `CLAUDE.md`; remove `.tmp-vite`.
- [x] 2. Hand-merge any Vite-suggested `.gitignore` entries into the existing `.gitignore` (do not overwrite;
      keep the secret/env rules).
- [x] 3. Install runtime deps: `react`, `react-dom`, `@mui/material`, `@mui/icons-material`, `@emotion/react`,
      `@emotion/styled`, `firebase`.
- [x] 4. Install dev deps: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`,
      `eslint`, `prettier`, `eslint-config-prettier`, `typescript-eslint`, `eslint-plugin-react-hooks`.

## Config
- [x] 5. Set `tsconfig.json` to `strict: true` (bundler resolution); confirm `tsconfig.node.json`.
- [x] 6. Configure `vite.config.ts`: `@vitejs/plugin-react` + Vitest `test` block (`environment: 'jsdom'`,
      `globals: true`, setup file for `@testing-library/jest-dom`).
- [x] 7. Add npm scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest run`),
      `lint` (`eslint .`), `format` (`prettier --write .`).
- [x] 8. Add ESLint config (TS + react-hooks + `eslint-config-prettier`) and `.prettierrc.json`.

## Firebase wiring (env only — no secrets)
- [x] 9. Create `src/vite-env.d.ts` typing the six `VITE_FIREBASE_*` keys on `ImportMetaEnv`.
- [x] 10. Create `src/firebase/config.ts` initializing Firebase from `import.meta.env.VITE_FIREBASE_*`; export `app`.
- [x] 11. Create `.env.example` with placeholder `VITE_FIREBASE_*` values (committed). Confirm `.env.local` is
      gitignored (`git check-ignore .env.local`).

## App shell & theme
- [x] 12. Create minimal `src/theme/theme.ts` (`createTheme` with an MD3 seed color) — note: expanded in ticket 009.
- [x] 13. Create `src/main.tsx` mounting `<App/>` inside `ThemeProvider` + `CssBaseline`.
- [x] 14. Create `src/App.tsx` minimal shell (app bar + a "Polla Mundialista" placeholder card). Remove Vite
      boilerplate/assets not used.

## Hosting & Firestore placeholders
- [x] 15. Create `firebase.json` (hosting `public: dist`, SPA rewrite to `/index.html`; wire `firestore.rules`
      + `firestore.indexes.json`).
- [x] 16. Create `.firebaserc` with placeholder `<your-project-id>`; create deny-all `firestore.rules`
      (`allow read, write: if false;`, rules_version '2') and empty `firestore.indexes.json`.

## Tests for the acceptance rules
- [x] 17. Write `src/App.test.tsx`: renders `<App/>`, asserts the "Polla Mundialista" title is present.
- [x] 18. Run `npm run build`, `npm test`, `npm run lint`, `npx prettier --check .` — all green; fix any errors.

## Deploy (guided manual)
- [x] 19. Firebase project `la-pollita-corp` created; `firebase login` done; real project id set in `.firebaserc`;
      `firebase deploy --only hosting` succeeded → **https://la-pollita-corp.web.app**.
      (Auth Google + Firestore enablement deferred to tickets 002 / 003 — not required for the hosting deploy.)

## Close-out
- [x] 20. Verified all 5 acceptance rules pass (build, dev+test, env/no-secrets, deploy, lint+prettier).
- [x] 21. Update `specs/backlog.md` status for 001 to ✅.

## Verification command(s)
```
npm run build
npm test
npm run lint
npx prettier --check .
git check-ignore .env.local        # expect: .env.local (ignored)
# grep: Firebase config must read only import.meta.env.VITE_* (no literal keys)
firebase deploy --only hosting     # manual: needs login + real project id
```
