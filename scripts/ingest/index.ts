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
import { scorePrediction, mergeScoring, DEFAULT_SCORING, type ScoringConfig } from './scoring.ts'
import { computeTournamentCutoffs } from './tournamentConfig.ts'
import { matchSignature, finishedSignature, decidePasses, type IngestSig } from './changeDetect.ts'
import type { FdMatchesResponse, FdStandingsResponse } from './types.ts'

const { Timestamp, FieldValue } = admin.firestore

/** Tournament window (UTC). Outside this range the job is a no-op. */
const WINDOW_START = Date.UTC(2026, 5, 11, 0, 0, 0) // 2026-06-11
const WINDOW_END = Date.UTC(2026, 6, 19, 23, 59, 59) // 2026-07-19

/**
 * Bump when the grading LOGIC changes so old predictions get re-graded.
 * Predictions store the version they were graded at; we skip re-grading when it
 * matches the current version (idempotent reruns) but re-grade when it differs.
 */
const SCORING_VERSION = 2

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
  /** The group's optional per-group scoring override (merged over the global base). */
  scoringOverride?: Partial<ScoringConfig>
  /** uid → displayName/photo/joinedAt for every participant (members + owner). */
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
 *
 * joinedAtMs is the leaderboard's final tie-break: each approved member's
 * `requestedAt` (Timestamp → ms), and the group's `createdAt` for the implicit
 * owner. A member doc without `requestedAt` falls back to the owner's join time
 * (the group's `createdAt`) so the earliest-joiner ordering stays deterministic;
 * if even `createdAt` is absent we use 0 (treated as "joined first").
 */
async function resolveGroupContext(
  db: FirebaseFirestore.Firestore,
  groupDoc: FirebaseFirestore.QueryDocumentSnapshot,
): Promise<GroupContext> {
  const groupId = groupDoc.id
  const group = groupDoc.data() as {
    ownerUid?: string
    createdAt?: FirebaseFirestore.Timestamp
    scoring?: Partial<ScoringConfig>
  }
  const ownerUid = group.ownerUid ?? ''
  const createdAtMs = group.createdAt ? group.createdAt.toMillis() : 0

  const membersSnap = await groupDoc.ref
    .collection('members')
    .where('status', '==', 'approved')
    .get()

  const byUid = new Map<string, ParticipantProfile>()
  for (const d of membersSnap.docs) {
    const data = d.data() as {
      uid?: string
      displayName?: string
      photoURL?: string | null
      requestedAt?: FirebaseFirestore.Timestamp
    }
    const uid = data.uid ?? d.id
    byUid.set(uid, {
      uid,
      displayName: data.displayName ?? '',
      photoURL: data.photoURL ?? null,
      // Member join time; if the doc predates requestedAt, fall back to the
      // group's createdAt so the tie-break stays deterministic.
      joinedAtMs: data.requestedAt ? data.requestedAt.toMillis() : createdAtMs,
    })
  }

  // The owner is an implicit approved admin — ensure a participant entry exists
  // even though they carry no member doc. They joined at group creation.
  if (ownerUid && !byUid.has(ownerUid)) {
    byUid.set(ownerUid, {
      uid: ownerUid,
      displayName: '',
      photoURL: null,
      joinedAtMs: createdAtMs,
    })
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

  return {
    groupId,
    ownerUid,
    scoringOverride: group.scoring,
    participants: [...byUid.values()],
  }
}

/**
 * Grade + rebuild the leaderboard for ONE group from a SINGLE predictions read
 * (ticket 033 — kills the previous double read).
 *
 * Previously `gradeGroupPredictions` and `rebuildGroupLeaderboard` EACH read the
 * whole `groups/{gid}/predictions` collection — two full reads per group per
 * working tick. Here we read it once, then:
 *   1. Grade the FINISHED, not-yet-graded-at-this-version predictions IN MEMORY
 *      and write back ONLY the newly-graded docs.
 *   2. Build the leaderboard from the in-memory set — stored points UNION this
 *      run's fresh grades, indexed by `{uid}_{matchId}` so a fresh grade
 *      OVERWRITES the stored one (never double-counted).
 *
 * Only predictions belonging to a participant are graded — predictions from a
 * removed member are left untouched (and excluded from the board anyway). The
 * grading output is byte-for-byte identical to the previous two-read code path.
 */
async function gradeAndBuildGroup(
  db: FirebaseFirestore.Firestore,
  ctx: GroupContext,
  finished: Map<string, { home: number; away: number; stage: string }>,
  cfg: ScoringConfig,
): Promise<{ graded: number; rows: number }> {
  const participantUids = new Set(ctx.participants.map((p) => p.uid))

  // --- The ONE read of this group's predictions. ---
  const predsSnap = await db.collection(`groups/${ctx.groupId}/predictions`).get()

  const writes: Array<{
    ref: FirebaseFirestore.DocumentReference
    data: FirebaseFirestore.UpdateData<unknown>
  }> = []

  // Aggregate the board from this single snapshot. Key by `{uid}_{matchId}` so a
  // prediction freshly graded this run overwrites its stored points exactly once.
  const boardByKey = new Map<string, GradedPrediction>()

  for (const doc of predsSnap.docs) {
    const p = doc.data() as {
      uid?: string
      matchId?: string
      homeGoals: number
      awayGoals: number
      points?: number | null
      breakdown?: GradedPrediction['breakdown']
      scoringVersion?: number
    }
    const uid = p.uid ?? doc.id.split('_')[0]
    const matchId = p.matchId ?? doc.id.slice(doc.id.indexOf('_') + 1)

    // Seed the board with the STORED grade (may be ungraded → ignored by
    // buildLeaderboard). buildLeaderboard already skips non-participant uids.
    boardByKey.set(`${uid}_${matchId}`, {
      uid,
      matchId,
      points: p.points,
      breakdown: p.breakdown,
    })

    if (!participantUids.has(uid)) continue // not an active participant — skip grading.

    const actual = finished.get(matchId)
    if (!actual) continue // match not FINISHED (or no result yet).

    // scoringVersion guard — skip already-graded-at-this-version predictions.
    if (p.scoringVersion === SCORING_VERSION) continue

    const { points, breakdown } = scorePrediction(
      { home: p.homeGoals, away: p.awayGoals },
      actual,
      cfg,
      actual.stage,
    )
    writes.push({
      ref: doc.ref,
      data: { points, breakdown, scoringVersion: SCORING_VERSION },
    })
    // Overwrite the stored entry with this run's fresh grade for the board.
    boardByKey.set(`${uid}_${matchId}`, { uid, matchId, points, breakdown })
  }

  // Write back ONLY the newly-graded docs.
  await commitInBatches(db, writes, (batch, w) => {
    batch.update(w.ref, w.data)
  })

  // --- Build the leaderboard from the in-memory set (no second read). ---
  // The denominator for EVERY participant is the set of FINISHED match ids
  // (ticket 034): a missing pick for a finished match counts as a 0-point graded
  // match. Derived from the same `finished` map the grading pass used — no extra
  // reads, no phantom prediction docs.
  const finishedMatchIds = new Set(finished.keys())
  const rows = buildLeaderboard([...boardByKey.values()], ctx.participants, finishedMatchIds)
  const updatedAt = Timestamp.now()
  const board = db.collection(`groups/${ctx.groupId}/leaderboard`)

  // Remove stale rows (e.g. a member who was removed) so the board exactly
  // mirrors the current participant set — keeps reruns idempotent.
  const existingSnap = await board.get()
  const keep = new Set(rows.map((r) => r.uid))
  const stale = existingSnap.docs.filter((d) => !keep.has(d.id))

  await commitInBatches(db, rows, (batch, row) => {
    // Persist joinedAt as a Firestore Timestamp on the LeaderboardEntry; the raw
    // joinedAtMs (a sort key for buildLeaderboard) is not stored on the doc.
    const { joinedAtMs, ...rest } = row
    batch.set(
      board.doc(row.uid),
      { ...rest, joinedAt: Timestamp.fromMillis(joinedAtMs), updatedAt },
      { merge: false },
    )
  })
  await commitInBatches(db, stale, (batch, d) => {
    batch.delete(d.ref)
  })

  return { graded: writes.length, rows: rows.length }
}

/**
 * Upsert group standings into standings/{group}.
 *
 * football-data returns WC standings as a SINGLE flat TOTAL table (group: null,
 * all 48 teams) rather than 12 per-group tables. We bucket that flat table into
 * groups using a team→group map derived from the group-stage matches, re-ranking
 * positions within each group. If football-data ever sends real per-group TOTAL
 * tables (group: 'GROUP_A'), we use those directly.
 */
async function upsertStandings(
  db: FirebaseFirestore.Firestore,
  standings: FdStandingsResponse,
  matches: MatchDoc[],
): Promise<number> {
  const updatedAt = Timestamp.now()

  type StRow = ReturnType<typeof mapRow>
  const mapRow = (r: FdStandingsResponse['standings'][number]['table'][number]) => ({
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
  })

  // team id -> group letter (A-L), from group-stage matches.
  const teamGroup = new Map<number, string>()
  for (const m of matches) {
    if (m.group && /^[A-L]$/.test(m.group)) {
      if (m.homeTeam?.id != null) teamGroup.set(m.homeTeam.id, m.group)
      if (m.awayTeam?.id != null) teamGroup.set(m.awayTeam.id, m.group)
    }
  }

  const all = standings.standings ?? []
  const perGroup: Record<string, StRow[]> = {}

  const groupedTables = all.filter((t) => t.type === 'TOTAL' && t.group)
  if (groupedTables.length) {
    for (const t of groupedTables) {
      const g = /^GROUP_([A-L])$/.exec(t.group ?? '')?.[1]
      if (g) perGroup[g] = t.table.map(mapRow)
    }
  } else {
    // Bucket the flat TOTAL table by each team's group.
    const flat = all.find((t) => t.type === 'TOTAL')
    for (const r of flat?.table ?? []) {
      const g = teamGroup.get(r.team.id ?? -1)
      if (!g) continue
      ;(perGroup[g] ??= []).push(mapRow(r))
    }
    // Re-number positions 1..N within each group (preserve global order).
    for (const g of Object.keys(perGroup)) {
      perGroup[g].sort((a, b) => a.position - b.position)
      perGroup[g].forEach((r, i) => (r.position = i + 1))
    }
  }

  const entries = Object.entries(perGroup)
  await commitInBatches(db, entries, (batch, [groupId, table]) => {
    batch.set(db.doc(`standings/${groupId}`), { groupId, table, updatedAt }, { merge: false })
  })
  return entries.length
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

/** The fetched API payloads `runIngest` operates on (injectable for tests). */
export interface FetchedData {
  matchesRes: FdMatchesResponse
  finishedRes: FdMatchesResponse
  standingsRes: FdStandingsResponse
}

/**
 * The orchestration core (ticket 033 — extracted from `main` so it can be driven
 * by an injected Firestore double in tests). Reads `config/meta` once, computes
 * the change-detection signatures, gates the global writes + per-group pass, and
 * persists the watermark. The window guard, real `getDb()`, and live fetch stay
 * in `main` so this stays free of credentials/network.
 */
export async function runIngest(
  db: FirebaseFirestore.Firestore,
  fetched: FetchedData,
  opts: { now?: Date; force?: boolean } = {},
): Promise<void> {
  const now = opts.now ?? new Date()
  const force = opts.force ?? false
  const { matchesRes, finishedRes, standingsRes } = fetched

  // Read config/meta ONCE up front (ticket 033). The persisted `sig` watermark
  // drives the change-detection guard that skips no-op ticks.
  const metaSnap = await db.doc('config/meta').get()
  const prevSig = metaSnap.exists
    ? ((metaSnap.data() as { sig?: Partial<IngestSig> }).sig ?? undefined)
    : undefined

  // Overlay authoritative FINISHED scores. The free tier can serve a finished
  // match's full-time score on the status-filtered endpoint a polling cycle (or
  // more) before it propagates to the unfiltered list. Patch the main list's entry
  // with the finished status+score whenever the filtered endpoint has a real
  // scoreline the main list is still missing — so grading isn't needlessly delayed.
  const finishedById = new Map(finishedRes.matches.map((m) => [m.id, m]))
  const mergedRaw = matchesRes.matches.map((m) => {
    const fin = finishedById.get(m.id)
    if (fin && fin.score?.fullTime?.home != null && fin.score?.fullTime?.away != null) {
      const mainHasScore = m.score?.fullTime?.home != null && m.score?.fullTime?.away != null
      if (!mainHasScore) return { ...m, status: fin.status, score: fin.score }
    }
    return m
  })

  const matches = mergedRaw.map((m) => mapMatch(m, now))

  // Change-detection (ticket 033). Compute the signatures from the mapped matches
  // (AFTER the FINISHED-score overlay above) and decide which passes to run.
  const matchSig = matchSignature(matches)
  const finishedSig = finishedSignature(matches)
  const decision = decidePasses(
    { matchSig, finishedSig, scoringVersion: SCORING_VERSION },
    prevSig,
    force,
  )
  console.log(
    `[ingest] passes: writeGlobals=${decision.writeGlobals} ` +
      `gradeAndBoard=${decision.gradeAndBoard} (force=${force})`,
  )

  // --- GLOBAL writes (matches, standings, cutoffs) — gated on writeGlobals. ---
  let standingsGroups = 0
  if (decision.writeGlobals) {
    console.log(`[ingest] upserting ${matches.length} matches…`)
    await upsertMatches(db, matches)

    standingsGroups = await upsertStandings(db, standingsRes, matches)
    console.log(`[ingest] upserted ${standingsGroups} group standings.`)

    // Global cutoffs the strict-mode prediction rules depend on (ticket 019).
    // merge:true so a partially-known bracket never clobbers a previously-written
    // knockout cutoff; admin-SDK-only writer keeps the two-writers rule intact.
    const cutoffs = computeTournamentCutoffs(matches)
    if (cutoffs.firstCupMatchKickoff || cutoffs.firstKnockoutKickoff) {
      await db.doc('config/tournament').set(cutoffs, { merge: true })
      console.log('[ingest] wrote config/tournament cutoffs', {
        firstCupMatchKickoff: cutoffs.firstCupMatchKickoff?.toDate().toISOString() ?? null,
        firstKnockoutKickoff: cutoffs.firstKnockoutKickoff?.toDate().toISOString() ?? null,
      })
    }
  } else {
    console.log('[ingest] matches unchanged — skipping global writes.')
  }

  // FINISHED full-time results, keyed by matchId — shared across all groups.
  // The `stage` rides along so per-group round bonuses can be applied at grading.
  const finished = new Map<string, { home: number; away: number; stage: string }>()
  for (const m of matches) {
    if (m.status !== 'FINISHED') continue
    if (m.score.home == null || m.score.away == null) continue
    finished.set(m.matchId, { home: m.score.home, away: m.score.away, stage: m.stage })
  }

  // --- Per-group grading + leaderboard (multi-tenant — ticket 012) — gated on
  //     gradeAndBoard (ticket 033). On a skip: ZERO prediction reads, ZERO
  //     prediction/leaderboard writes. ---
  let totalGraded = 0
  let totalBoardRows = 0
  let groupsCount = 0
  if (decision.gradeAndBoard) {
    // GLOBAL base config (config/scoring ∪ DEFAULT_SCORING). Each group's effective
    // config is this base with the group's optional `scoring` override merged on top.
    const globalBase = await loadScoringConfig(db)

    const groupsSnap = await db.collection('groups').get()
    groupsCount = groupsSnap.size
    for (const groupDoc of groupsSnap.docs) {
      const ctx = await resolveGroupContext(db, groupDoc)
      const effective = mergeScoring(globalBase, ctx.scoringOverride)
      // ONE predictions read per group — grading + board from a single snapshot.
      const { graded, rows } = await gradeAndBuildGroup(db, ctx, finished, effective)
      totalGraded += graded
      totalBoardRows += rows
      console.log(
        `[ingest] group ${ctx.groupId}: ${ctx.participants.length} participants, ` +
          `graded ${graded} predictions, leaderboard ${rows} rows.`,
      )
    }
    console.log(
      `[ingest] graded ${totalGraded} predictions across ${groupsCount} groups ` +
        `(scoringVersion ${SCORING_VERSION}).`,
    )
  } else {
    console.log('[ingest] no new/changed finish — skipping per-group grading + leaderboard.')
  }

  // Persist the watermark. Update only the parts whose pass actually ran so a
  // fully-skipped tick leaves the prior watermark intact (ticket 033):
  //   - sig.matches when globals were written,
  //   - sig.finished + sig.scoringVersion when the per-group pass ran.
  const sigUpdate: Partial<IngestSig> = {}
  if (decision.writeGlobals) sigUpdate.matches = matchSig
  if (decision.gradeAndBoard) {
    sigUpdate.finished = finishedSig
    sigUpdate.scoringVersion = SCORING_VERSION
  }

  await db.doc('config/meta').set(
    {
      lastIngestRun: {
        at: Timestamp.now(),
        matches: matches.length,
        groups: groupsCount,
        gradedPredictions: totalGraded,
        leaderboardRows: totalBoardRows,
        standingsGroups,
        scoringVersion: SCORING_VERSION,
        writeGlobals: decision.writeGlobals,
        gradeAndBoard: decision.gradeAndBoard,
        ok: true,
      },
      lastIngestAt: FieldValue.serverTimestamp(),
      // merge:true on the nested `sig` updates only the keys present in sigUpdate.
      sig: sigUpdate,
    },
    { merge: true },
  )

  console.log('[ingest] done.')
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
  const fetched: FetchedData = {
    matchesRes: await client.getMatches(),
    finishedRes: await client.getFinishedMatches(),
    standingsRes: await client.getStandings(),
  }

  await runIngest(db, fetched, { now, force })
}

// Only run the live job when executed directly (not when imported by a test).
if (process.env.INGEST_NO_MAIN !== '1') {
  main().catch((err) => {
    console.error('[ingest] FAILED:', err)
    process.exitCode = 1
  })
}
