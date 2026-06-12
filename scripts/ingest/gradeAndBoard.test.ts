// @vitest-environment node
//
// Orchestration tests for ticket 033 — drive `runIngest` with an injected
// in-memory Firestore double that counts reads/writes, proving:
//   Rule 1 — a no-op tick does ZERO prediction reads and writes ZERO
//            prediction/leaderboard docs.
//   Rule 2 — a working tick reads each group's `predictions` collection EXACTLY
//            once (the single-read refactor).
//   Rule 4 — `force` AND a bumped SCORING_VERSION each run the full per-group
//            pass despite an unchanged finishedSig.
//   Rule 5 — per-prediction points/breakdown + leaderboard rows are byte-for-byte
//            identical to the pre-change two-read baseline (computed here directly
//            from the SAME shared engine + buildLeaderboard).
//
// The fake never touches credentials or the network. We set INGEST_NO_MAIN before
// importing index.ts so the module's live `main()` does not auto-run on import.

process.env.INGEST_NO_MAIN = '1'

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Timestamp } from 'firebase-admin/firestore'
import { runIngest, type FetchedData } from './index.ts'
import { mapMatch } from './mapMatch.ts'
import {
  buildLeaderboard,
  type GradedPrediction,
  type ParticipantProfile,
} from './buildLeaderboard.ts'
import { scorePrediction, DEFAULT_SCORING } from './scoring.ts'
import type { FdMatchesResponse, FdStandingsResponse, FdMatch } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const load = <T>(file: string): T => JSON.parse(readFileSync(resolve(__dirname, file), 'utf8')) as T

const matchesSample = load<FdMatchesResponse>('sample/matches.json')
const standingsSample = load<FdStandingsResponse>('sample/standings.json')

interface SampleMember {
  uid: string
  displayName: string
  photoURL?: string | null
  role: string
  status: string
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
}
const groupsSample = load<{ groups: SampleGroup[] }>('sample/groups.json')

const FIXED_NOW = new Date('2026-06-12T00:00:00Z')

/** Run the orchestrator against the fake, casting through the admin Firestore type. */
function run(
  fs: FakeFirestore,
  opts: { now?: Date; force?: boolean },
  f = fetched(),
): Promise<void> {
  return runIngest(fs as unknown as FirebaseFirestore.Firestore, f, opts)
}

// ============================================================================
// In-memory Firestore double with read/write counters.
//
// Models exactly the access patterns runIngest uses:
//   db.doc(path).get()/.set()
//   db.collection(path).get()/.where(...).get()/.doc(id)
//   doc.ref.collection('members')…  (group sub-collections)
//   db.batch().set()/.update()/.delete()/.commit()
// ============================================================================

interface Counters {
  predictionReads: number // # of `groups/{gid}/predictions` collection .get()s
  predictionCollections: Set<string> // distinct prediction collections read
  predictionWrites: number
  leaderboardWrites: number
  matchWrites: number
}

function makeCounters(): Counters {
  return {
    predictionReads: 0,
    predictionCollections: new Set(),
    predictionWrites: 0,
    leaderboardWrites: 0,
    matchWrites: 0,
  }
}

const isPredictionsPath = (p: string) => /^groups\/[^/]+\/predictions$/.test(p)
const isLeaderboardPath = (p: string) => /^groups\/[^/]+\/leaderboard\//.test(p)
const isMatchPath = (p: string) => /^matches\//.test(p)
const isPredictionDocPath = (p: string) => /^groups\/[^/]+\/predictions\//.test(p)

class FakeFirestore {
  /** path → document data (plain objects). */
  readonly store = new Map<string, Record<string, unknown>>()
  readonly counters = makeCounters()

  doc(path: string): FakeDocRef {
    return new FakeDocRef(this, path)
  }
  collection(path: string): FakeCollectionRef {
    return new FakeCollectionRef(this, path)
  }
  batch(): FakeBatch {
    return new FakeBatch(this)
  }
}

class FakeDocRef {
  constructor(
    readonly fs: FakeFirestore,
    readonly path: string,
  ) {}
  get id(): string {
    return this.path.slice(this.path.lastIndexOf('/') + 1)
  }
  async get(): Promise<{ exists: boolean; id: string; ref: FakeDocRef; data: () => unknown }> {
    const data = this.fs.store.get(this.path)
    return {
      exists: data !== undefined,
      id: this.id,
      ref: this,
      data: () => data,
    }
  }
  async set(data: Record<string, unknown>, opts?: { merge?: boolean }): Promise<void> {
    this.applySet(data, opts)
  }
  collection(sub: string): FakeCollectionRef {
    return new FakeCollectionRef(this.fs, `${this.path}/${sub}`)
  }
  /** Shared write path used by both .set() and batch.set(), with counters. */
  applySet(data: Record<string, unknown>, opts?: { merge?: boolean }): void {
    const prev = this.fs.store.get(this.path)
    const next = opts?.merge ? deepMerge(prev ?? {}, data) : { ...data }
    this.fs.store.set(this.path, next)
    this.countWrite()
  }
  applyUpdate(data: Record<string, unknown>): void {
    const prev = this.fs.store.get(this.path) ?? {}
    this.fs.store.set(this.path, { ...prev, ...data })
    this.countWrite()
  }
  applyDelete(): void {
    this.fs.store.delete(this.path)
    this.countWrite()
  }
  private countWrite(): void {
    if (isPredictionDocPath(this.path)) this.fs.counters.predictionWrites++
    else if (isLeaderboardPath(this.path)) this.fs.counters.leaderboardWrites++
    else if (isMatchPath(this.path)) this.fs.counters.matchWrites++
  }
}

interface QueryDoc {
  id: string
  ref: FakeDocRef
  data: () => Record<string, unknown>
}

class FakeCollectionRef {
  private filters: Array<{ field: string; value: unknown }> = []
  constructor(
    readonly fs: FakeFirestore,
    readonly path: string,
  ) {}

  where(field: string, _op: string, value: unknown): FakeCollectionRef {
    const q = new FakeCollectionRef(this.fs, this.path)
    q.filters = [...this.filters, { field, value }]
    return q
  }

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.fs, `${this.path}/${id}`)
  }

  async get(): Promise<{ docs: QueryDoc[]; size: number }> {
    // Count a prediction-collection read (rule 2 instrumentation).
    if (isPredictionsPath(this.path)) {
      this.fs.counters.predictionReads++
      this.fs.counters.predictionCollections.add(this.path)
    }

    const prefix = `${this.path}/`
    const docs: QueryDoc[] = []
    for (const [docPath, data] of this.fs.store) {
      // Only DIRECT children of this collection (no deeper sub-collection docs).
      if (!docPath.startsWith(prefix)) continue
      const rest = docPath.slice(prefix.length)
      if (rest.includes('/')) continue
      if (!this.filters.every((f) => data[f.field] === f.value)) continue
      const ref = new FakeDocRef(this.fs, docPath)
      docs.push({ id: ref.id, ref, data: () => data })
    }
    return { docs, size: docs.length }
  }
}

type BatchOp =
  | { kind: 'set'; ref: FakeDocRef; data: Record<string, unknown>; merge?: boolean }
  | { kind: 'update'; ref: FakeDocRef; data: Record<string, unknown> }
  | { kind: 'delete'; ref: FakeDocRef }

class FakeBatch {
  private ops: BatchOp[] = []
  constructor(readonly fs: FakeFirestore) {}
  set(ref: FakeDocRef, data: Record<string, unknown>, opts?: { merge?: boolean }): FakeBatch {
    this.ops.push({ kind: 'set', ref, data, merge: opts?.merge })
    return this
  }
  update(ref: FakeDocRef, data: Record<string, unknown>): FakeBatch {
    this.ops.push({ kind: 'update', ref, data })
    return this
  }
  delete(ref: FakeDocRef): FakeBatch {
    this.ops.push({ kind: 'delete', ref })
    return this
  }
  async commit(): Promise<void> {
    for (const op of this.ops) {
      if (op.kind === 'set') op.ref.applySet(op.data, { merge: op.merge })
      else if (op.kind === 'update') op.ref.applyUpdate(op.data)
      else op.ref.applyDelete()
    }
    this.ops = []
  }
}

function deepMerge(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a }
  for (const [k, v] of Object.entries(b)) {
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      !(v instanceof Timestamp) &&
      out[k] &&
      typeof out[k] === 'object'
    ) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

// ============================================================================
// Seed helpers — build a FakeFirestore from the sample fixtures.
// ============================================================================

function seedDb(): FakeFirestore {
  const fs = new FakeFirestore()
  // users/{uid} so resolveGroupContext name-backfill never falls through.
  const names: Record<string, string> = {
    u_ana: 'Ana',
    u_beto: 'Beto',
    u_caro: 'Caro',
    u_dani: 'Dani',
  }
  for (const [uid, displayName] of Object.entries(names)) {
    fs.store.set(`users/${uid}`, { displayName, photoURL: null })
  }

  for (const g of groupsSample.groups) {
    fs.store.set(`groups/${g.groupId}`, {
      ownerUid: g.ownerUid,
      createdAt: Timestamp.fromMillis(1000),
    })
    for (const m of g.members) {
      fs.store.set(`groups/${g.groupId}/members/${m.uid}`, {
        uid: m.uid,
        displayName: m.displayName,
        photoURL: m.photoURL ?? null,
        status: m.status,
        requestedAt: Timestamp.fromMillis(2000),
      })
    }
    for (const p of g.predictions) {
      fs.store.set(`groups/${g.groupId}/predictions/${p.uid}_${p.matchId}`, {
        uid: p.uid,
        matchId: p.matchId,
        homeGoals: p.homeGoals,
        awayGoals: p.awayGoals,
      })
    }
  }
  return fs
}

/** Fetched payload that mirrors the live job's three calls. */
function fetched(matches: FdMatch[] = matchesSample.matches): FetchedData {
  return {
    matchesRes: { ...matchesSample, matches },
    finishedRes: { ...matchesSample, matches: matches.filter((m) => m.status === 'FINISHED') },
    standingsRes: standingsSample,
  }
}

// ============================================================================
// Pre-change BASELINE (rule 5): grade with the shared engine + buildLeaderboard
// directly from the fixtures (the two-read code path produced identical output).
// ============================================================================

const finishedActual = new Map<string, { home: number; away: number; stage: string }>()
for (const raw of matchesSample.matches) {
  const doc = mapMatch(raw, FIXED_NOW)
  if (doc.status === 'FINISHED' && doc.score.home != null && doc.score.away != null) {
    finishedActual.set(doc.matchId, {
      home: doc.score.home,
      away: doc.score.away,
      stage: doc.stage,
    })
  }
}

function approvedParticipants(g: SampleGroup): ParticipantProfile[] {
  const byUid = new Map<string, ParticipantProfile>()
  for (const m of g.members) {
    if (m.status !== 'approved') continue
    byUid.set(m.uid, {
      uid: m.uid,
      displayName: m.displayName,
      photoURL: m.photoURL ?? null,
      joinedAtMs: 2000,
    })
  }
  if (!byUid.has(g.ownerUid)) {
    const fromMember = g.members.find((m) => m.uid === g.ownerUid)
    byUid.set(g.ownerUid, {
      uid: g.ownerUid,
      displayName: fromMember?.displayName ?? g.ownerUid,
      photoURL: fromMember?.photoURL ?? null,
      joinedAtMs: 1000,
    })
  }
  return [...byUid.values()]
}

/** The expected per-prediction grade + leaderboard for a group (baseline). */
function baselineFor(g: SampleGroup) {
  const participants = approvedParticipants(g)
  const uids = new Set(participants.map((p) => p.uid))
  const grades = new Map<string, { points: number; breakdown: unknown }>()
  const boardInput: GradedPrediction[] = []
  for (const p of g.predictions) {
    if (!uids.has(p.uid)) continue
    const actual = finishedActual.get(p.matchId)
    if (!actual) continue
    const { points, breakdown } = scorePrediction(
      { home: p.homeGoals, away: p.awayGoals },
      actual,
      DEFAULT_SCORING,
      actual.stage,
    )
    grades.set(`${p.uid}_${p.matchId}`, { points, breakdown })
    boardInput.push({ uid: p.uid, matchId: p.matchId, points, breakdown })
  }
  const finishedMatchIds = new Set(finishedActual.keys())
  const board = buildLeaderboard(boardInput, participants, finishedMatchIds)
  return { grades, board }
}

// ============================================================================
// Tests
// ============================================================================

describe('runIngest — change-detection guard + single read (ticket 033)', () => {
  let fs: FakeFirestore

  beforeEach(() => {
    fs = seedDb()
  })

  it('rule 1 — a no-op tick does 0 prediction reads and 0 prediction/leaderboard writes', async () => {
    // First run (force) establishes the watermark + grades everything.
    await run(fs, { now: FIXED_NOW, force: true })
    // Reset counters; the SECOND run with identical data must be a no-op.
    Object.assign(fs.counters, makeCounters())

    await run(fs, { now: FIXED_NOW, force: false })

    expect(fs.counters.predictionReads).toBe(0)
    expect(fs.counters.predictionWrites).toBe(0)
    expect(fs.counters.leaderboardWrites).toBe(0)
    expect(fs.counters.matchWrites).toBe(0)
  })

  it('rule 2 — a working tick reads each group predictions collection exactly once', async () => {
    // No watermark yet ⇒ a full pass. Each group's predictions must be read once.
    await run(fs, { now: FIXED_NOW, force: false })

    const groupCount = groupsSample.groups.length
    expect(fs.counters.predictionReads).toBe(groupCount)
    expect(fs.counters.predictionCollections.size).toBe(groupCount)
  })

  it('rule 4a — force runs the full per-group pass despite an unchanged finishedSig', async () => {
    await runIngest(fs, fetched(), { now: FIXED_NOW, force: true }) // establish watermark
    Object.assign(fs.counters, makeCounters())

    // Same data + force ⇒ full pass again (predictions read per group).
    await run(fs, { now: FIXED_NOW, force: true })
    expect(fs.counters.predictionReads).toBe(groupsSample.groups.length)
  })

  it('rule 4b — a bumped SCORING_VERSION (stale watermark) runs the full pass', async () => {
    await runIngest(fs, fetched(), { now: FIXED_NOW, force: true }) // establish watermark
    // Simulate a SCORING_VERSION bump: the stored sig.scoringVersion is now stale
    // relative to the code's current version. Lower it so decidePasses sees a
    // mismatch on the next (non-force) tick → gradeAndBoard.
    const meta = fs.store.get('config/meta') as { sig?: { scoringVersion?: number } }
    if (meta?.sig) meta.sig.scoringVersion = -1
    Object.assign(fs.counters, makeCounters())

    await run(fs, { now: FIXED_NOW, force: false })
    // The version mismatch bypassed the guard → the per-group pass ran (each
    // group's predictions were read), even though no NEW match finished. (No
    // per-prediction WRITE occurs here because the docs are already graded at the
    // code's current SCORING_VERSION; a real code-constant bump would also trip
    // the per-prediction guard and re-write — see rule 5 for grade fidelity.)
    expect(fs.counters.predictionReads).toBe(groupsSample.groups.length)
    expect(fs.counters.leaderboardWrites).toBeGreaterThan(0)
  })

  it('rule 5 — per-prediction grades + leaderboard rows are byte-identical to the baseline', async () => {
    await run(fs, { now: FIXED_NOW, force: false })

    for (const g of groupsSample.groups) {
      const { grades, board } = baselineFor(g)

      // Per-prediction points + breakdown.
      for (const [key, expected] of grades) {
        const stored = fs.store.get(`groups/${g.groupId}/predictions/${key}`) as {
          points: number
          breakdown: unknown
        }
        expect(stored.points).toBe(expected.points)
        expect(stored.breakdown).toEqual(expected.breakdown)
      }

      // Leaderboard rows (totalPoints, counts, rank) — byte-for-byte.
      for (const row of board) {
        const stored = fs.store.get(`groups/${g.groupId}/leaderboard/${row.uid}`) as {
          totalPoints: number
          exactCount: number
          outcomeCount: number
          predictionsGraded: number
          rank: number
          displayName: string
        }
        expect(stored.totalPoints).toBe(row.totalPoints)
        expect(stored.exactCount).toBe(row.exactCount)
        expect(stored.outcomeCount).toBe(row.outcomeCount)
        expect(stored.predictionsGraded).toBe(row.predictionsGraded)
        expect(stored.rank).toBe(row.rank)
      }

      // The board exactly mirrors the participant set (no extra rows).
      const storedRows = [...fs.store.keys()].filter((k) =>
        k.startsWith(`groups/${g.groupId}/leaderboard/`),
      )
      expect(storedRows.length).toBe(board.length)
    }
  })

  it('writes matches on the first (full) pass and skips them on an unchanged tick', async () => {
    await run(fs, { now: FIXED_NOW, force: false })
    expect(fs.counters.matchWrites).toBeGreaterThan(0)

    Object.assign(fs.counters, makeCounters())
    await run(fs, { now: FIXED_NOW, force: false })
    expect(fs.counters.matchWrites).toBe(0)
  })
})
