// One-off surgical seed for the global `config/tournament` doc (ticket 019).
//
// Unlike the full ingestion job, this script makes NO football-data.org call and
// writes EXACTLY ONE document. It:
//   1. reads the matches ALREADY in Firestore (the 104 seeded fixtures),
//   2. computes the two cutoffs with the shared `computeTournamentCutoffs`,
//   3. prints them, and
//   4. writes ONLY `config/tournament` (merge) — unless run with --dry-run.
//
// It never touches matches, standings, predictions, members, groups, users, or
// leaderboards. Run:
//   npx tsx scripts/ingest/seedTournamentConfig.ts --dry-run   (preview only)
//   npx tsx scripts/ingest/seedTournamentConfig.ts             (write the doc)

import { getDb } from './firestoreAdmin.ts'
import { computeTournamentCutoffs } from './tournamentConfig.ts'
import type { MatchDoc } from './mapMatch.ts'

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const db = getDb()

  console.log('[seed] reading matches/* from Firestore (no football-data call)…')
  const snap = await db.collection('matches').get()
  const matches = snap.docs.map((d) => d.data() as MatchDoc)
  console.log(`[seed] read ${matches.length} matches.`)

  const cutoffs = computeTournamentCutoffs(matches)

  const fmt = (label: string, ts?: { toDate(): Date }) =>
    `  ${label}: ${ts ? ts.toDate().toISOString() : '(none — no matches for that stage)'}`
  console.log('[seed] computed config/tournament:')
  console.log(fmt('firstCupMatchKickoff (first GROUP_STAGE)', cutoffs.firstCupMatchKickoff))
  console.log(fmt('firstKnockoutKickoff (first LAST_32)    ', cutoffs.firstKnockoutKickoff))

  if (!cutoffs.firstCupMatchKickoff && !cutoffs.firstKnockoutKickoff) {
    throw new Error(
      '[seed] No GROUP_STAGE or LAST_32 matches found in Firestore — refusing to write an empty doc. ' +
        'Are matches seeded?',
    )
  }

  if (dryRun) {
    console.log('[seed] --dry-run: NOT writing. Re-run without --dry-run to persist.')
    return
  }

  await db.doc('config/tournament').set(cutoffs, { merge: true })
  console.log('[seed] wrote config/tournament (merge). Done.')
}

main().catch((err) => {
  console.error('[seed] FAILED:', err)
  process.exitCode = 1
})
