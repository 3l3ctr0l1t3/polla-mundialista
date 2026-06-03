import { defineConfig } from 'vitest/config'

// Dedicated config for the ingestion job's unit tests. These run in a Node
// environment — NO jsdom, NO React `src/test/setup.ts`, NO Firestore emulator,
// and NO credentials. They exercise the pure helpers (`mapMatch`,
// `buildLeaderboard`) against saved sample fixtures using the real shared
// scoring engine. Invoked via `npm run test:ingest`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['**/*.test.ts'],
  },
})
