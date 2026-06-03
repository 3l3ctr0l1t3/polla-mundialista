// Ingestion orchestrator — the ONLY server-side writer.
//
// Per run:
//   0. Early-exit outside the tournament window (saves Actions minutes), unless
//      INGEST_FORCE=1 (set by workflow_dispatch input).
//   1. Fetch WC matches + standings (rate-limited v4 client).        [GLOBAL]
//   2. Upsert matches/{fdId} — idempotent, id-keyed.                 [GLOBAL]
//   3. Upsert standings/{group}.                                     [GLOBAL]
//   4. Write config/meta.lastIngestRun (+ lastIngestAt).             [GLOBAL]
//   5. For EACH group in groups/* (multi-tenant — ticket 012):
//        a. Resolve the participant set = approved members
//           (groups/{gid}/members where status==='approved') UNION the implicit
//           owner (groups/{gid}.ownerUid, who carries no member doc).
//        b. Grade FINISHED matches via the SHARED scoring engine, writing
//           points/breakdown to groups/{gid}/predictions/{uid}_{matchId}. A
//           per-prediction `scoringVersion` guard avoids re-grading.
//        c. Rebuild that group's groups/{gid}/leaderboard/{uid}
//           (dense rank + tiebreakers) from its graded predictions.
//
// Matches/standings/config stay GLOBAL (top-level). Predictions + leaderboards
// are group-scoped. Fails non-zero on any error so a failed cron shows red.

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

/** A group plus its resolved participant set (approved members ∪ implicit owner). */
interface GroupContext {
  groupId: string
  ownerUid: string
  /** uid → displayName/photo for every participant (members + owner). */
  participants: ParticipantProfile[]
}

/**
 * Resolve the participant set for one group:
 *   approved members (groups/{gid}/members where status==='approved')
 *   ∪ the implicit owner (groups/{gid}.ownerUid — has NO member doc).
 *
 * displayName/photo come from each member doc; for the implicit owner (and any
 * member doc missing a name) we fall back to the global users/{uid} profile,
 * then to the uid itself so a leaderboard row is never nameless.
 */
async function resolveGroupContext(
  db: FirebaseFirestore.Firestore,
  groupDoc: FirebaseFirestore.QueryDocumentSnapshot,
): Promise<GroupContext> {
  const groupId = groupDoc.id
  const group = groupDoc.data() as { ownerUid?: string }
  const ownerUid = group.ownerUid ?? ''

  const membersSnap = await groupDoc.ref
    .collection('members')
    .where('status', '==', 'approved')
    .get()

  const byUid = new Map<string, ParticipantProfile>()
  for (const d of membersSnap.docs) {
    const data = d.data() as { uid?: string; displayName?: string; photoURL?: string | null }
    const uid = data.uid ?? d.id
    byUid.set(uid, {
      uid,
      displayName: data.displayName ?? '',
      photoURL: data.photoURL ?? null,
    })
  }

  // The owner is an implicit approved admin — ensure a participant entry exists
  // even though they carry no member doc.
  if (ownerUid && !byUid.has(ownerUid)) {
    byUid.set(ownerUid, { uid: ownerUid, displayName: '', photoURL: null })
  }

  // Backfill any missing displayName from the global users/{uid} profile.
  const needProfile = [...byUid.values()].filter((p) => !p.displayName)
  await Promise.all(
    needProfile.map(async (p) => {
      const userSnap = await db.doc(`users/${p.uid}`).get()
      const u = userSnap.exists
        ? (userSnap.data() as { displayName?: string; photoURL?: string | null })
        : undefined
      p.displayName = u?.displayName || p.uid
      if (p.photoURL == null) p.photoURL = u?.photoURL ?? null
    }),
  )

  return { groupId, ownerUid, participants: [...byUid.values()] }
}

/**
 * Grade FINISHED matches for ONE group; write points/breakdown to each of that
 * group's predictions (groups/{gid}/predictions/{uid}_{matchId}). Only
 * predictions belonging to a participant are graded — predictions from a
 * removed member are left untouched (and excluded from the board anyway).
 */
async function gradeGroupPredictions(
  db: FirebaseFirestore.Firestore,
  ctx: GroupContext,
  finished: Map<string, { home: number; away: number }>,
  cfg: ScoringConfig,
): Promise<number> {
  const participantUids = new Set(ctx.participants.map((p) => p.uid))
  const writes: Array<{
    ref: FirebaseFirestore.DocumentReference
    data: FirebaseFirestore.UpdateData<unknown>
  }> = []

  const predsSnap = await db.collection(`groups/${ctx.groupId}/predictions`).get()

  for (const doc of predsSnap.docs) {
    const p = doc.data() as {
      uid?: string
      matchId?: string
      homeGoals: number
      awayGoals: number
      scoringVersion?: number
    }
    const uid = p.uid ?? doc.id.split('_')[0]
    if (!participantUids.has(uid)) continue // not an active participant — skip.

    const matchId = p.matchId ?? doc.id.slice(doc.id.indexOf('_') + 1)
    const actual = finished.get(matchId)
    if (!actual) continue // match not FINISHED (or no result yet).

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
  }

  await commitInBatches(db, writes, (batch, w) => {
    batch.update(w.ref, w.data)
  })
  return writes.length
}

/**
 * Recompute ONE group's leaderboard from its graded predictions, restricted to
 * that group's participant set. Writes groups/{gid}/leaderboard/{uid}.
 */
async function rebuildGroupLeaderboard(
  db: FirebaseFirestore.Firestore,
  ctx: GroupContext,
): Promise<number> {
  const predsSnap = await db.collection(`groups/${ctx.groupId}/predictions`).get()

  const predictions: GradedPrediction[] = predsSnap.docs.map((d) => {
    const data = d.data()
    return {
      uid: data.uid ?? d.id.split('_')[0],
      points: data.points,
      breakdown: data.breakdown,
    }
  })

  const rows = buildLeaderboard(predictions, ctx.participants)
  const updatedAt = Timestamp.now()
  const board = db.collection(`groups/${ctx.groupId}/leaderboard`)

  // Remove stale rows (e.g. a member who was removed) so the board exactly
  // mirrors the current participant set — keeps reruns idempotent.
  const existingSnap = await board.get()
  const keep = new Set(rows.map((r) => r.uid))
  const stale = existingSnap.docs.filter((d) => !keep.has(d.id))

  await commitInBatches(db, rows, (batch, row) => {
    batch.set(board.doc(row.uid), { ...row, updatedAt }, { merge: false })
  })
  await commitInBatches(db, stale, (batch, d) => {
    batch.delete(d.ref)
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

  const standingsGroups = await upsertStandings(db, standingsRes)
  console.log(`[ingest] upserted ${standingsGroups} group standings.`)

  // FINISHED full-time results, keyed by matchId — shared across all groups.
  const finished = new Map<string, { home: number; away: number }>()
  for (const m of matches) {
    if (m.status !== 'FINISHED') continue
    if (m.score.home == null || m.score.away == null) continue
    finished.set(m.matchId, { home: m.score.home, away: m.score.away })
  }

  const cfg = await loadScoringConfig(db)

  // Per-group grading + leaderboard (multi-tenant — ticket 012).
  const groupsSnap = await db.collection('groups').get()
  let totalGraded = 0
  let totalBoardRows = 0
  for (const groupDoc of groupsSnap.docs) {
    const ctx = await resolveGroupContext(db, groupDoc)
    const graded = await gradeGroupPredictions(db, ctx, finished, cfg)
    const rows = await rebuildGroupLeaderboard(db, ctx)
    totalGraded += graded
    totalBoardRows += rows
    console.log(
      `[ingest] group ${ctx.groupId}: ${ctx.participants.length} participants, ` +
        `graded ${graded} predictions, leaderboard ${rows} rows.`,
    )
  }
  console.log(
    `[ingest] graded ${totalGraded} predictions across ${groupsSnap.size} groups ` +
      `(scoringVersion ${SCORING_VERSION}).`,
  )

  await db.doc('config/meta').set(
    {
      lastIngestRun: {
        at: Timestamp.now(),
        matches: matches.length,
        groups: groupsSnap.size,
        gradedPredictions: totalGraded,
        leaderboardRows: totalBoardRows,
        standingsGroups,
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
