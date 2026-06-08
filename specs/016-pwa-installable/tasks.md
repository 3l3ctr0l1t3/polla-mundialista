# 016 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. Add devDependencies `vite-plugin-pwa` and `@vite-pwa/assets-generator`; add npm scripts
  `generate-pwa-assets` and `verify:pwa` to `package.json`.
- [x] 2. Create `public/pwa-icon.svg` — source artwork (neon "P"/ball on `#07090a`, using `src/theme/`
  colors) for icon generation.
- [x] 3. Create `pwa-assets.config.ts` and run `npm run generate-pwa-assets` to emit
  `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`,
  `public/apple-touch-icon-180x180.png`, `public/favicon.ico` (+ `public/pwa-64x64.png`). Commit the
  generated PNGs. NOTE: the minimal2023Preset names the iOS icon `apple-touch-icon-180x180.png`.
- [x] 4. Add `VitePWA({ registerType:'autoUpdate', manifest:{…}, workbox:{…}, devOptions:{enabled:false} })`
  to the `plugins` array in `vite.config.ts` (manifest colors `#07090a`; icons per plan; Workbox
  precache + `navigateFallback:'index.html'` + `navigateFallbackDenylist` for firestore/identitytoolkit;
  single read-only CacheFirst route for Google Fonts only — NO route matching write/API origins).
- [x] 5. Add `/// <reference types="vite-plugin-pwa/client" />` to `src/vite-env.d.ts`; wire
  `virtual:pwa-register` in `src/main.tsx` only if `autoUpdate` does not self-register. (Not needed —
  `autoUpdate` self-registers via the injected `registerSW.js`; `src/main.tsx` untouched.)
- [x] 6. Edit `index.html` minimally: keep the `theme-color` meta; add `apple-mobile-web-app-capable` +
  `apple-mobile-web-app-status-bar-style` meta and the `apple-touch-icon` link. (Plugin injects the
  manifest link at build.)
- [x] 7. Create `scripts/verify-pwa.mjs` — post-build assertions: `dist/manifest.webmanifest` parses with
  name/short_name/start_url/display:standalone/theme_color/background_color and ≥192/512/maskable icons;
  icon PNGs exist in `dist/`; `dist/sw.js` exists; precache references `index.html` + a hashed asset;
  `sw.js` has NO firestore/identitytoolkit/firebaseio runtime route (AC6). Exit non-zero on any failure.
- [x] 8. Run `npm run build` then `node scripts/verify-pwa.mjs` (AC1–3, AC5–6) — green (20/20 passed).
- [x] 9. Confirm `npm run dev` still serves the app with no SW in dev (AC8) — boots, HTTP 200.
- [x] 10. Run the gates: `npm run build`, `npm test` (113 passed), `npm run lint` (0 errors),
  `npx prettier --check .` (clean) — all green (AC9).
- [x] 11. Document the manual checks in the ticket: DevTools → Application offline-reload renders the shell
  (AC4) and Lighthouse PWA "Installable" passes (AC7), to be run against `firebase serve`/preview. See
  "Manual verification" below.

## Manual verification (AC4 offline shell · AC7 installability)
Run against a production preview (the SW is disabled in dev): `npm run build` then
`npx firebase serve --only hosting` (or `npm run preview`), open the served URL in Chrome.
- **AC4 — offline app shell:** DevTools → Application → Service Workers shows the SW activated; then
  DevTools → Network → check "Offline" (or Application → "Offline") and reload. The app renders its own
  shell/loading UI from precache, NOT the browser's dead-dino offline page. Fixtures/leaderboard show
  empty/loading states (offline data is out of scope by design).
- **AC7 — installable:** DevTools → Application → Manifest shows name/icons/theme with no errors, and an
  install / "Add to Home Screen" affordance appears; Lighthouse → PWA category reports "Installable" pass.
- [x] 12. Run `/spec-verify 016` and confirm all acceptance rules pass. (7/7 automatable PASS;
  AC4/AC7 are manual browser checks with all prerequisites present.)
- [x] 13. Update `specs/backlog.md` status for 016 to ✅¹ with a footnote noting AC4/AC7 manual.

## Verification command(s)
```
npm run build
node scripts/verify-pwa.mjs
npm test -- --run
npm run lint
npx prettier --check .
# manual: npx firebase serve  (or hosting preview) → Lighthouse PWA / DevTools offline reload
```
