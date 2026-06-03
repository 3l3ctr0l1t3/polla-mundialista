/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Rules-unit-tests run against the Firestore emulator via `npm run test:rules`
    // (no jsdom, no setup file). Keep them out of the default `npm test` run.
    exclude: ['**/node_modules/**', '**/dist/**', 'test/rules/**'],
  },
})
