# 016 — Installable PWA (app shell offline)

> Status: 🟦 spec ready · Depends on: 009, 010 · Specialist: react-mui-builder

## Why
Polla Mundialista runs entirely in the browser and is not installable: there is no web app manifest and no
service worker, so it cannot be added to a phone/desktop home screen, never launches full-screen, and shows
the browser "no connection" page when opened offline. This ticket makes the app an installable PWA whose
**app shell + built assets** are cached so it launches instantly (and offline once visited) and auto-updates
when a new version is deployed. This is **Tier 1 only**: installability + offline app shell + update flow.

## User story
As a **participant**, I want to **install Polla Mundialista to my home screen and have it launch full-screen
and load instantly (even with no network)** so that **it feels like a native app and I am not blocked by the
browser's offline page when I open it**.

## Scope
- **Web app manifest** served from the build and linked from `index.html`, with: `name` ("Polla
  Mundialista"), `short_name` ("Polla"), `start_url`, `display: standalone`, `theme_color` and
  `background_color` set to the existing brand dark `#07090a` (matching the `<meta name="theme-color">`
  already in `index.html` and the `src/theme/` "La Pollita" tokens), and an icon set.
- **Icons** under `public/`: at minimum a **192×192** and a **512×512** standard icon plus one **512×512
  maskable** icon, referenced from the manifest.
- **Service worker** that **precaches the built app shell** (the Vite-emitted JS/CSS/HTML) so that, after a
  first online visit, the app renders its own shell with the network offline (not the browser dead-dinosaur
  page). SPA navigation falls back to the cached `index.html`.
- **Auto-update flow** so a new deploy is picked up and the shell is never indefinitely stale (chosen
  approach: `vite-plugin-pwa` in **`autoUpdate`** registration — new SW activates and the next load serves
  fresh assets; the planner may instead wire a user-visible "new version available, refresh" prompt and must
  state which it implemented).
- **Chosen tech:** `vite-plugin-pwa` (Workbox) generating the precache manifest of built assets + the web app
  manifest. The plugin's `devOptions` are configured so `npm run dev` keeps working.
- **Runtime-caching guardrail:** Workbox config precaches navigation + static assets **only**. It MUST NOT
  add runtime caching that intercepts Firestore / Google API traffic (especially write/POST traffic) — see
  Non-goals and the Constitution links.

## Non-goals
- **Offline Firestore data** — caching fixtures/predictions/leaderboard reads (e.g. Firestore
  `persistentLocalCache`/IndexedDB persistence). Deliberately deferred to a separate ticket.
- **Offline or queued prediction WRITES** and any kickoff-lock reconciliation of replayed writes. The SW
  must never cache, queue, or replay a prediction write. (Separate ticket, because of the server-time
  kickoff-lock interaction.)
- **Push notifications**, **background sync**, and **periodic background sync**.
- **App-store packaging** (TWA / Android Studio / Capacitor / iOS wrapper).
- **Any change to `firestore.rules`**, the scoring engine, or the ingestion job.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. **Manifest served & linked.** After `npm run build`, `dist/` contains a valid web app manifest
   (`dist/manifest.webmanifest` or equivalent) that is linked from the built `index.html` via
   `<link rel="manifest" …>`. The manifest includes `name`, `short_name`, `start_url`, `display: standalone`,
   `theme_color`, and `background_color`, with `theme_color`/`background_color` equal to `#07090a`.
   Verifiable by inspecting the built `dist/` output.
2. **Icons present.** The manifest references at least a **192×192** icon, a **512×512** icon, and one
   **512×512 maskable** icon (`purpose: "maskable"`), and those icon files exist in `dist/`. Verifiable by
   inspecting `dist/` and the manifest `icons[]`.
3. **Service worker precaches the app shell.** A production build emits a service worker
   (`dist/sw.js` or equivalent) with a Workbox **precache manifest** that includes the app shell — the
   built JS/CSS and `index.html`. Verifiable by inspecting `dist/` (the SW + precache entries reference the
   hashed build assets and the navigation fallback).
4. **Offline app shell.** After one online load registers the SW, reloading with the **network offline**
   renders the app's own shell (the app UI / loading state), **not** the browser's offline error page.
   Verifiable as a documented manual check (DevTools → Application → Offline, then reload) since it needs a
   real browser; the precache + navigation-fallback config in (3) is the inspectable proxy.
5. **Update flow — no stale-forever shell.** On a new deploy the SW updates so the user gets fresh assets
   without a manual cache clear. The implementation is **`autoUpdate`** (new SW takes over and the next load
   serves fresh assets) unless the planner documents a user-visible refresh prompt instead; whichever is
   implemented is stated in `plan.md`. Verifiable by inspecting the `vite-plugin-pwa` `registerType` config.
6. **No write traffic intercepted (two-writers / kickoff lock preserved).** The Workbox configuration has
   **no runtime-caching route that matches Firestore or Google API requests**; it precaches navigation +
   static assets only. No prediction write is cached, queued, or replayed by the SW. Verifiable by inspecting
   the plugin/Workbox config (absence of `runtimeCaching` for `firestore.googleapis.com` / `*.googleapis.com`
   write traffic; `navigateFallbackDenylist` excludes API/auth paths if a navigation fallback is used).
7. **Installable criteria met.** The app passes the browser's PWA install criteria (served over HTTPS — a SPA
   already met by Firebase Hosting — plus a valid linked manifest, registered SW, and the required icons), so
   an install / "Add to Home Screen" prompt is available. Verifiable as a documented manual check via
   Lighthouse / Chrome DevTools "Installability".
8. **Dev mode still works.** `npm run dev` still serves the app (the plugin's `devOptions` are configured so
   the SW does not break local development). Verifiable by running `npm run dev`.
9. **Quality gates stay green.** `npm run build` (type-check + build), `npm test`, `npm run lint`, and
   `npx prettier --check .` all pass with the change in place.

## Constitution links
- **Free-tier only (Principle 6):** the service worker and manifest are **static assets** shipped via
  Firebase Hosting — no Cloud Functions and no paid dependency; `vite-plugin-pwa` is a build-time dev
  dependency only.
- **No secrets in the repo (Principle 5):** the manifest, icons, and service worker contain only **public**
  assets and the existing public Firebase config — no secret is introduced into the public bundle.
- **Two-writers rule (Principle 3) & Authoritative kickoff lock (Principle 4):** explicitly **preserved** —
  this ticket adds **no** Firestore writes, and the SW MUST NOT intercept, cache, queue, or replay any write
  or auth traffic (acceptance rule 6). Locking remains enforced by server time in `firestore.rules`.
- **Spec-first (Principle 1):** behavior is specified here before any code.
- **Done = tested + meets acceptance rules (Principle 7):** the inspectable build artifacts and quality gates
  are the automated checks; offline render and installability are documented manual browser checks.

## Notes / open questions
- **Assumption — registration mode:** the recommended default is `vite-plugin-pwa` `registerType: 'autoUpdate'`
  for the simplest "never stale" behavior. If the planner prefers a user-visible refresh prompt
  (`prompt` mode), it must implement the prompt UI consistent with `src/theme/` and document the choice.
- **Assumption — icon source art:** real brand artwork may not exist yet; the planner may generate
  placeholder neon icons consistent with `#07090a`/the "La Pollita" palette so the install criteria are met,
  flagging that final artwork can be swapped later without a spec change.
- **Navigation fallback:** if a `navigateFallback` to `index.html` is used for SPA routing, its denylist must
  exclude Firebase/Google auth and API paths so the SW never shadows real network calls (supports rule 6).
- **Offline data is out of scope by design:** opening the app offline will render the shell but show empty /
  loading states for fixtures/predictions/leaderboard until the network returns. The follow-up Tier 2 ticket
  (Firestore offline persistence + offline write reconciliation against the kickoff lock) is intentionally
  separate.
