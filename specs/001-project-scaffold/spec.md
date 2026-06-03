# 001 — Project scaffold & tooling

> Status: 🟦 spec ready · Depends on: — · Specialist: react-mui-builder

## Why
Nothing can be built until the app skeleton, tooling, and Firebase wiring exist. This ticket stands up a
deployable empty shell so every later ticket has a place to land.

## User story
As a **developer**, I want **a configured Vite + React + TS + MUI app wired to Firebase** so that **later
tickets build features instead of plumbing**.

## Scope
- `npm create vite` (react-ts) project at repo root; install MUI + `@emotion/*` + Firebase SDK.
- Vitest + ESLint + Prettier configured; `strict` TypeScript.
- `src/firebase/config.ts` initializes Firebase from `import.meta.env` (`VITE_*`); `.env.example` committed,
  `.env.local` gitignored.
- `firebase.json`, `.firebaserc`, empty `firestore.rules` placeholder, `firestore.indexes.json`.
- A minimal `App.tsx` shell behind an MUI `ThemeProvider` + `CssBaseline`.

## Non-goals
- No auth, data model, predictions, or theming polish (those are their own tickets).

## Acceptance rules (definition of done)
1. `npm run build` type-checks and produces `dist/` with no errors.
2. `npm run dev` serves the shell; `npm test` runs (even if only a sample test) and passes.
3. Firebase initializes from env vars; no secrets are hard-coded; `.env.local` is gitignored.
4. `firebase deploy --only hosting` publishes the shell to a `*.web.app` URL.
5. ESLint + Prettier pass clean.

## Constitution links
- Free-tier only (Spark/Hosting). No secrets in repo. TypeScript everywhere.

## Notes / open questions
- Confirm Firebase project created in console (Spark) with Google Auth + Firestore enabled before deploy.
