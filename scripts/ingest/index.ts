// Ingestion orchestrator — the ONLY server-side writer.
//
// Per run:
//   0. Early-exit outside the tournament window (saves Actions minutes), unless
//      INGEST_FORCE=1 (set by workflow_dispatch input).
//   1. Fetch WC matches + standings (rate-limited v4 client).
//   2. Upsert matches/{fdId} — idempotent, id-keyed.
//   3. Grade FINISHED matches via the SHARED scoring engine, writing
//      points/breakdown to predictions/{uid}_{matchId}. A `scoringVersion` guard
//      on each prediction avoids re-grading at the same scoring version.
//   4. Rebuild the full leaderboard/{uid} (dense rank + tiebreakers).
//   5. Upsert standings/{group}.
//   6. Write config/meta.lastIngestRun (+ lastIngestAt).
//
// Fails non-zero on any error so a failed cron shows red.

import { admin, getDb } from './firestoreAdmin.ts'
import { FootballDataClient } from './footballData.ts'
import { mapMatch, type MatchDoc } from './mapMatch.ts'
import {
  buildLeaderboard,
  type ParticipantProfile,
  type GradedPrediction,
} from './buildLeaderboard.ts'
import { scorePrediction, DEFAULT_SCORING, type ScoringConfig } from './scoring.ts'
import type { FdStandingsResponse } from './types.ts'

const { Timestamp, FieldValue } = admin.firestore

/** Tournament window (UTC). Outside this range the job is a no-op. */
const WINDOW_START = Date.UTC(2026, 5, 11, 0, 0, 0) // 2026-06-11
const WINDOW_END = Date.UTC(2026, 6, 19, 23, 59, 59) // 2026-07-19

/**
 * Bump when the grading LOGIC changes so old predictions get re-graded.
 * Predictions store the version they were graded at; we skip re-grading when it
 * matches the current version (idempotent reruns) but re-grade when it differs.
 */
const SCORING_VERSION = 1

function withinWindow(now: Date): boolean {
  const t = now.getTime()
  return t >= WINDOW_START && t <= WINDOW_END
}

/** Load the scoring config from config/scoring, falling back to the default. */
async function loadScoringConfig(db: FirebaseFirestore.Firestore): Promise<ScoringConfig> {
  const snap = await db.doc('config/scoring').get()
  if (!snap.exists) return DEFAULT_SCORING
  return { ...DEFAULT_SCORING, ...(snap.data() as Partial<ScoringConfig>) }
}

/** Upsert all matches (idempotent, id-keyed) in chunked batches. */
async function upsertMatches(db: FirebaseFirestore.Firestore, matches: MatchDoc[]): Promise<void> {
  await commitInBatches(db, matches, (batch, m) => {
    batch.set(db.doc(`matches/${m.matchId}`), m, { merge: true })
  })
}

/** Grade FINISHED matches; write points/breakdown to each prediction. */
async function gradeFinishedMatches(
  db: FirebaseFirestore.Firestore,
  matches: MatchDoc[],
  cfg: ScoringConfig,
): Promise<number> {
  let graded = 0
  const writes: Array<{
    ref: FirebaseFirestore.DocumentReference
    data: FirebaseFirestore.UpdateData<unknown>
  }> = []

  for (const m of matches) {
    if (m.status !== 'FINISHED') continue
    if (m.score.home == null || m.score.away == null) continue
    const actual = { home: m.score.home, away: m.score.away }

    const predsSnap = await db.collection('predictions').where('matchId', '==', m.matchId).get()

    for (const doc of predsSnap.docs) {
      const p = doc.data() as {
        homeGoals: number
        awayGoals: number
        scoringVersion?: number
      }
      // scoringVersion guard — skip already-graded-at-this-version predictions.
      if (p.scoringVersion === SCORING_VERSION) continue

      const { points, breakdown } = scorePrediction(
        { home: p.homeGoals, away: p.awayGoals },
        actual,
        cfg,
      )
      writes.push({
        ref: doc.ref,
        data: { points, breakdown, scoringVersion: SCORING_VERSION },
      })
      graded += 1
    }
  }

  await commitInBatches(db, writes, (batch, w) => {
    batch.update(w.ref, w.data)
  })
  return graded
}

/** Recompute the full leaderboard from all graded predictions. */
async function rebuildLeaderboard(db: FirebaseFirestore.Firestore): Promise<number> {
  const [predsSnap, usersSnap] = await Promise.all([
    db.collection('predictions').get(),
    db.collection('users').get(),
  ])

  const predictions: GradedPrediction[] = predsSnap.docs.map((d) => {
    const data = d.data()
    return { uid: data.uid, points: data.points, breakdown: data.breakdown }
  })

  const users: ParticipantProfile[] = usersSnap.docs.map((d) => {
    const data = d.data()
    return { uid: data.uid, displayName: data.displayName, photoURL: data.photoURL ?? null }
  })

  const rows = buildLeaderboard(predictions, users)
  const updatedAt = Timestamp.now()

  await commitInBatches(db, rows, (batch, row) => {
    batch.set(db.doc(`leaderboard/${row.uid}`), { ...row, updatedAt }, { merge: false })
  })
  return rows.length
}

/** Upsert group standings (TOTAL tables) into standings/{group}. */
async function upsertStandings(
  db: FirebaseFirestore.Firestore,
  standings: FdStandingsResponse,
): Promise<number> {
  const updatedAt = Timestamp.now()
  const tables = (standings.standings ?? []).filter((t) => t.type === 'TOTAL' && t.group)

  await commitInBatches(db, tables, (batch, t) => {
    const groupId = /^GROUP_([A-L])$/.exec(t.group ?? '')?.[1]
    if (!groupId) return
    const table = t.table.map((r) => ({
      position: r.position,
      team: {
        id: r.team.id ?? -1,
        name: r.team.name ?? 'TBD',
        shortName: r.team.shortName ?? r.team.name ?? 'TBD',
        tla: r.team.tla ?? 'TBD',
        crest: r.team.crest ?? '',
      },
      playedGames: r.playedGames,
      won: r.won,
      draw: r.draw,
      lost: r.lost,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      goalDifference: r.goalDifference,
      points: r.points,
    }))
    batch.set(db.doc(`standings/${groupId}`), { groupId, table, updatedAt }, { merge: false })
  })
  return tables.length
}

/** Commit writes in chunks of 400 (well under the 500/batch limit). */
async function commitInBatches<T>(
  db: FirebaseFirestore.Firestore,
  items: T[],
  apply: (batch: FirebaseFirestore.WriteBatch, item: T) => void,
): Promise<void> {
  const CHUNK = 400
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = db.batch()
    for (const item of items.slice(i, i + CHUNK)) apply(batch, item)
    await batch.commit()
  }
}

async function main(): Promise<void> {
  const now = new Date()
  const force = process.env.INGEST_FORCE === '1'

  if (!withinWindow(now) && !force) {
    console.log(
      `[ingest] ${now.toISOString()} is outside the tournament window ` +
        `(2026-06-11 .. 2026-07-19). Early-exit. Set INGEST_FORCE=1 to override.`,
    )
    return
  }

  const db = getDb()
  const client = new FootballDataClient()

  console.log('[ingest] fetching matches + standings…')
  const [matchesRes, standingsRes] = [await client.getMatches(), await client.getStandings()]

  const matches = matchesRes.matches.map((m) => mapMatch(m, now))
  console.log(`[ingest] upserting ${matches.length} matches…`)
  await upsertMatches(db, matches)

  const cfg = await loadScoringConfig(db)
  const graded = await gradeFinishedMatches(db, matches, cfg)
  console.log(`[ingest] graded ${graded} predictions (scoringVersion ${SCORING_VERSION}).`)

  const boardSize = await rebuildLeaderboard(db)
  console.log(`[ingest] rebuilt leaderboard for ${boardSize} participants.`)

  const groups = await upsertStandings(db, standingsRes)
  console.log(`[ingest] upserted ${groups} group standings.`)

  await db.doc('config/meta').set(
    {
      lastIngestRun: {
        at: Timestamp.now(),
        matches: matches.length,
        gradedPredictions: graded,
        leaderboardSize: boardSize,
        standingsGroups: groups,
        scoringVersion: SCORING_VERSION,
        ok: true,
      },
      lastIngestAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  console.log('[ingest] done.')
}

main().catch((err) => {
  console.error('[ingest] FAILED:', err)
  process.exitCode = 1
})
