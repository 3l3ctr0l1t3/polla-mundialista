/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: a new build (new asset hashes) silently takes over on the
      // next load — no manual cache clear, no user prompt. Satisfies AC5.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'pwa-icon.svg'],
      manifest: {
        name: 'Polla Mundialista',
        short_name: 'Polla',
        description: 'FIFA World Cup 2026 score-prediction pool',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Brand dark — kept in lockstep with <meta name="theme-color"> and
        // src/theme/tokens.ts (background.default).
        background_color: '#07090a',
        theme_color: '#07090a',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // CONSTITUTION GUARD (AC6 — two-writers rule / authoritative kickoff lock):
      // the service worker precaches the built app shell + handles SPA navigation
      // ONLY. It MUST NOT sit in front of Firestore/Auth WRITE traffic.
      //  - navigateFallbackDenylist excludes firestore.googleapis.com,
      //    identitytoolkit, and the Firebase reserved /__/ paths so the navigation
      //    fallback never shadows real API/auth calls.
      //  - The ONLY runtimeCaching route is a read-only CacheFirst for Google
      //    Fonts. There is deliberately NO route matching firestore.googleapis.com
      //    / identitytoolkit / *.firebaseio.com — no write is cached, queued, or
      //    replayed by the SW.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/__/, /firestore\.googleapis\.com/, /identitytoolkit/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      // SW stays out of dev so `npm run dev` keeps HMR simple (AC8); it only
      // activates in production builds.
      devOptions: { enabled: false },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Rules-unit-tests run against the Firestore emulator via `npm run test:rules`
    // (no jsdom, no setup file). Keep them out of the default `npm test` run.
    exclude: ['**/node_modules/**', '**/dist/**', 'test/rules/**'],
  },
})
