# 016 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Add **`vite-plugin-pwa`** (Workbox-backed) to the existing Vite build. It generates the service
worker + precache manifest from the built assets and injects the `<link rel="manifest">` into the
built `index.html`. Registration mode is **`autoUpdate`** (new deploys silently take over on next
load — simplest, no UI, satisfies AC5; documented as the chosen mode).

The manifest is declared inline in `vite.config.ts` so its colors stay in lockstep with the existing
`<meta name="theme-color" content="#07090a">` (theme_color = background_color = `#07090a`, matching
`src/theme/` tokens). Icons are generated from one source SVG via **`@vite-pwa/assets-generator`**
(dev-only dep, deterministic, regenerable) into `public/` — a 192, a 512, and a 512 maskable PNG,
plus apple-touch-icon/favicon.

Workbox is constrained to **precache + navigation only**: `globPatterns` covers the built JS/CSS/HTML
app shell; `navigateFallback: 'index.html'` keeps the SPA working offline; a
`navigateFallbackDenylist` excludes Firebase/Firestore/Auth reserved paths so the SW NEVER sits in
front of write traffic (AC6 — two-writers / kickoff lock preserved). The ONLY runtime-caching route is
a read-only `CacheFirst` for the Google Fonts origins (stylesheet + webfont GETs), which is safe and
standard; no route matches `firestore.googleapis.com` / `identitytoolkit` / `*.firebaseio.com`.

SW is left **disabled in dev** (`devOptions.enabled: false`, the default) so `npm run dev` stays simple
and HMR-friendly (AC8); the SW only activates in production builds.

A tiny `scripts/verify-pwa.mjs` checker makes AC1–3 automatically verifiable: after `npm run build` it
asserts `dist/` contains the manifest (with required keys + ≥192/512/maskable icons), `sw.js`, and a
precache entry for the shell. The verifier runs it; installability + true offline reload (AC4/AC7)
remain documented manual Lighthouse/DevTools checks.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `package.json` | edit | add devDeps `vite-plugin-pwa`, `@vite-pwa/assets-generator`; add scripts `generate-pwa-assets`, `verify:pwa` |
| `vite.config.ts` | edit | add `VitePWA({ registerType:'autoUpdate', manifest:{…}, workbox:{…}, devOptions:{enabled:false} })` to `plugins` |
| `pwa-assets.config.ts` | new | asset-generator preset pointing at the source SVG |
| `public/pwa-icon.svg` | new | source artwork (neon "P"/ball on `#07090a`, theme colors) |
| `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png` | new (generated) | manifest icons |
| `public/apple-touch-icon.png`, `public/favicon.ico` | new (generated) | iOS/tab icons |
| `index.html` | edit (minimal) | keep `theme-color`; add `apple-mobile-web-app-*` meta + apple-touch-icon link (plugin injects the manifest link) |
| `src/main.tsx` | edit (only if needed) | `autoUpdate` self-registers via `virtual:pwa-register`; add registration only if not auto-injected |
| `src/vite-env.d.ts` | edit | add `/// <reference types="vite-plugin-pwa/client" />` for virtual-module types |
| `scripts/verify-pwa.mjs` | new | post-build assertion of manifest + sw + icons in `dist/` |
| `specs/016-pwa-installable/tasks.md` | edit | filled by `/spec-tasks 016` |

## Data shapes / interfaces
```ts
// vite.config.ts — manifest (colors locked to #07090a)
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-icon.svg'],
  manifest: {
    name: 'Polla Mundialista',
    short_name: 'Polla',
    description: 'FIFA World Cup 2026 score-prediction pool',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#07090a',
    theme_color: '#07090a',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/__/, /firestore\.googleapis\.com/, /identitytoolkit/],
    runtimeCaching: [{
      urlPattern: ({ url }) =>
        url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
      handler: 'CacheFirst',
      options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60*60*24*365 } },
    }],
  },
  devOptions: { enabled: false },
})
```

## Reused utilities
- Existing `vite.config.ts` (`react()` plugin + vitest config) — extend its `plugins` array only.
- Existing `<meta name="theme-color">` and `src/theme/` tokens — manifest colors mirror them (no new color source; honors "all theming in src/theme/").
- Firebase Hosting deploy path (`npm run build` → `firebase deploy --only hosting`) — unchanged; the SW/manifest ship as static `dist/` assets (free-tier, no Functions).

## Test strategy
- **AC1–3 (manifest/icons/SW precache):** `npm run build` then `node scripts/verify-pwa.mjs` asserts
  `dist/manifest.webmanifest` parses with required keys + the three icons, the icon PNGs exist in
  `dist/`, `dist/sw.js` exists, and the generated precache references `index.html` + a hashed JS asset.
- **AC4 (offline shell) & AC7 (installable):** documented manual check — `firebase serve`/preview, DevTools
  → Application → Service Workers + Offline reload renders the shell; Lighthouse PWA "Installable" passes.
- **AC5 (update flow):** assert `registerType: 'autoUpdate'` in config (verify-pwa greps `dist/sw.js`
  for the Workbox `clientsClaim`/`skipWaiting` from autoUpdate).
- **AC6 (no write traffic intercepted):** verify-pwa asserts the generated `sw.js`/workbox config has NO
  runtime route matching `firestore`/`identitytoolkit`/`firebaseio`, and the denylist is present.
- **AC8 (dev):** `npm run dev` boots (manual/CI smoke) — `devOptions.enabled:false` means no SW in dev.
- **AC9 (gates):** `npm run build`, `npm test`, `npm run lint`, `npx prettier --check .` green.

## Risks
- **SW caching stale app forever** → `autoUpdate` + Workbox precache revisioning; new build = new hashes,
  SW updates on next load. Mitigated by AC5 check.
- **SW intercepting Firestore writes / auth** → no runtimeCaching route matches those origins; navigation
  denylist excludes them. This is the key constitution guard (AC6); call it out in code comments.
- **Icon generation needs binary PNGs** → use `@vite-pwa/assets-generator` from an SVG source (dev-only,
  regenerable); commit the generated PNGs so CI builds without the generator step.
- **Offline fonts** → Google Fonts cached read-only (CacheFirst); first offline visit before the font
  cache warms falls back to system fonts — acceptable (non-goal to guarantee offline fonts).
- **`virtual:pwa-register` types** → add the client type reference to `src/vite-env.d.ts` so `tsc -b`
  stays green.
