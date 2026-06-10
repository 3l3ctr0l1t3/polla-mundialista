// @vitest-environment node
//
// Per-group ingestion (ticket 012). Verifies — fully OFFLINE, no creds, no
// network, no emulator — that grading + leaderboard building are isolated per
// group, that the implicit owner (no member doc) participates, and that pending
// members and IN_PLAY matches are excluded.
//
// This drives the SAME pure pieces the orchestrator (index.ts) uses per group:
//   resolve participant set (approved members ∪ implicit owner)
//   → grade each FINISHED match with the REAL shared engine
//   → buildLeaderboard(group predictions, group participants).
// Only the Firestore I/O (which needs creds) lives outside this test.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  buildLeaderboard,
  type GradedPrediction,
  type ParticipantProfile,
  type LeaderboardRow,
} from './buildLeaderboard.ts'
import { mapMatch } from './mapMatch.ts'
import { scorePrediction, type Scoreline } from './scoring.ts'
import type { FdMatchesResponse, FdMatch } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const matchesSample = JSON.parse(
  readFileSync(resolve(__dirname, 'sample/matches.json'), 'utf8'),
) as FdMatchesResponse

interface SampleMember {
  uid: string
  displayName: string
  photoURL?: string | null
  role: string
  status: string
  /** Optional join time (ms); mirrors a member doc's `requestedAt.toMillis()`. */
  requestedAtMs?: number
}
interface SamplePrediction {
  uid: string
  matchId: string
  homeGoals: number
  awayGoals: number
}
interface SampleGroup {
  groupId: string
  ownerUid: string
  members: SampleMember[]
  predictions: SamplePrediction[]
  /** Optional group creation time (ms); mirrors `createdAt.toMillis()` (owner join). */
  createdAtMs?: number
}
const groupsSample = JSON.parse(readFileSync(resolve(__dirname, 'sample/groups.json'), 'utf8')) as {
  groups: SampleGroup[]
}

const groupById = (id: string): SampleGroup => {
  const g = groupsSample.groups.find((x) => x.groupId === id)
  if (!g) throw new Error(`fixture missing group ${id}`)
  return g
}

// ---- Shared "actual results" derived from the GLOBAL matches sample. ----
const matchById = (id: number): FdMatch => {
  const m = matchesSample.matches.find((x) => x.id === id)
  if (!m) throw new Error(`fixture missing match ${id}`)
  return m
}
/** FINISHED full-time results keyed by matchId — the input to per-group grading. */
const finished = new Map<string, Scoreline>()
for (const raw of matchesSample.matches) {
  const doc = mapMatch(matchById(raw.id))
  if (doc.status === 'FINISHED' && doc.score.home != null && doc.score.away != null) {
    finished.set(doc.matchId, { home: doc.score.home, away: doc.score.away })
  }
}

// ---- The pure per-group pipeline (mirrors index.ts, sans Firestore I/O). ----

/** Participant set = approved members ∪ the implicit owner (no member doc). */
function resolveParticipants(g: SampleGroup): ParticipantProfile[] {
  const byUid = new Map<string, ParticipantProfile>()
  for (const m of g.members) {
    if (m.status !== 'approved') continue
    byUid.set(m.uid, { uid: m.uid, displayName: m.displayName, photoURL: m.photoURL ?? null })
  }
  // Implicit owner: approved admin even without a member doc.
  if (!byUid.has(g.ownerUid)) {
    const fromMember = g.members.find((m) => m.uid === g.ownerUid)
    byUid.set(g.ownerUid, {
      uid: g.ownerUid,
      // In the real job a missing name is backfilled from users/{uid}; the
      // offline fixture supplies it so the assertion is deterministic.
      displayName: fromMember?.displayName ?? g.ownerUid,
      photoURL: fromMember?.photoURL ?? null,
    })
  }
  return [...byUid.values()]
}

/** Grade a group's predictions: only participants, only FINISHED matches. */
function gradeGroup(g: SampleGroup, participants: ParticipantProfile[]): GradedPrediction[] {
  const uids = new Set(participants.map((p) => p.uid))
  const out: GradedPrediction[] = []
  for (const p of g.predictions) {
    if (!uids.has(p.uid)) continue // pending / non-participant → never graded.
    const actual = finished.get(p.matchId)
    if (!actual) continue // not FINISHED (e.g. IN_PLAY 500004) → ungraded.
    const { points, breakdown } = scorePrediction({ home: p.homeGoals, away: p.awayGoals }, actual)
    out.push({ uid: p.uid, points, breakdown })
  }
  return out
}

/** End-to-end per-group: resolve → grade → build board. */
function boardFor(groupId: string): {
  participants: ParticipantProfile[]
  board: LeaderboardRow[]
} {
  const g = groupById(groupId)
  const participants = resolveParticipants(g)
  const graded = gradeGroup(g, participants)
  return { participants, board: buildLeaderboard(graded, participants) }
}

const rowOf = (board: LeaderboardRow[], uid: string): LeaderboardRow => {
  const r = board.find((x) => x.uid === uid)
  if (!r) throw new Error(`no leaderboard row for ${uid}`)
  return r
}

describe('per-group ingestion (two-group isolation)', () => {
  it('g_amigos: implicit owner participates; pending excluded; IN_PLAY ungraded', () => {
    const { participants, board } = boardFor('g_amigos')

    // Participant set: owner u_ana (implicit, no member doc) + approved members.
    expect(participants.map((p) => p.uid).sort()).toEqual(['u_ana', 'u_beto', 'u_caro'])
    expect(board.map((r) => r.uid)).not.toContain('u_pending')

    // Totals via the REAL shared engine (exact hit = 5 + gd bonus 1 = 6).
    expect(rowOf(board, 'u_ana').totalPoints).toBe(15) // 6 + 6 + 3
    expect(rowOf(board, 'u_beto').totalPoints).toBe(13) // 4 + 6 + 3
    expect(rowOf(board, 'u_caro').totalPoints).toBe(4) // outcome 3 + gd 1

    // u_caro predicted 500004 (IN_PLAY) — it must NOT count as graded.
    expect(rowOf(board, 'u_caro').predictionsGraded).toBe(1)

    // Counts + dense ranks.
    expect(rowOf(board, 'u_ana')).toMatchObject({ exactCount: 2, outcomeCount: 1, rank: 1 })
    expect(rowOf(board, 'u_beto')).toMatchObject({ exactCount: 1, outcomeCount: 2, rank: 2 })
    expect(rowOf(board, 'u_caro')).toMatchObject({ exactCount: 0, outcomeCount: 1, rank: 3 })
    expect(board.map((r) => r.uid)).toEqual(['u_ana', 'u_beto', 'u_caro'])
  })

  it('g_oficina: same users, different predictions → independent results', () => {
    const { participants, board } = boardFor('g_oficina')

    // Owner u_dani has a real member doc here; all three approved.
    expect(participants.map((p) => p.uid).sort()).toEqual(['u_ana', 'u_beto', 'u_dani'])

    expect(rowOf(board, 'u_dani').totalPoints).toBe(18) // three exact: 6+6+6
    expect(rowOf(board, 'u_ana').totalPoints).toBe(6) // miss (0) + exact (6)
    expect(rowOf(board, 'u_beto').totalPoints).toBe(6) // one exact (6)

    expect(rowOf(board, 'u_dani')).toMatchObject({ exactCount: 3, rank: 1 })
    // Ana & Beto tie on points→exact→outcome; displayName breaks it (Ana < Beto).
    expect(rowOf(board, 'u_ana').rank).toBe(2)
    expect(rowOf(board, 'u_beto').rank).toBe(2)
    expect(board.map((r) => r.uid)).toEqual(['u_dani', 'u_ana', 'u_beto'])
  })

  it('overlapping users are scored independently across groups', () => {
    const amigos = boardFor('g_amigos').board
    const oficina = boardFor('g_oficina').board

    // u_ana: top of g_amigos (15) but mid g_oficina (6).
    expect(rowOf(amigos, 'u_ana').totalPoints).toBe(15)
    expect(rowOf(oficina, 'u_ana').totalPoints).toBe(6)

    // u_beto: 13 in g_amigos, 6 in g_oficina.
    expect(rowOf(amigos, 'u_beto').totalPoints).toBe(13)
    expect(rowOf(oficina, 'u_beto').totalPoints).toBe(6)

    // A group's roster never leaks into the other's board.
    expect(amigos.map((r) => r.uid)).not.toContain('u_dani')
    expect(oficina.map((r) => r.uid)).not.toContain('u_caro')
  })
})
