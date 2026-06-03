import { defineConfig } from 'vitest/config'

// Dedicated config for Firestore rules-unit-tests. These run in a Node environment
// against the Firestore emulator (started by `firebase emulators:exec`) — no jsdom,
// no React test setup. Invoked via `npm run test:rules`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/rules/**/*.test.ts'],
    // Rules tests share a single emulator; run files serially to avoid cross-test races.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
