import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the PWA icon set from a single source image (public/pwa-icon-source.jpg —
// the "La Pollita CORP" rooster crest, extracted from the brand artwork). The generator
// emits its assets NEXT TO the source, so the source lives in public/ for the outputs to
// land there. It is a .jpg on purpose: the SW precache glob matches png/svg/ico only, so
// this source ships (tiny) but is never precached.
//   public/pwa-64x64.png, pwa-192x192.png, pwa-512x512.png,
//   maskable-icon-512x512.png, apple-touch-icon-180x180.png, favicon.ico
// Run with `npm run generate-pwa-assets`. The emitted PNGs are committed so the
// build never depends on regenerating them.
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/pwa-icon-source.jpg'],
})
