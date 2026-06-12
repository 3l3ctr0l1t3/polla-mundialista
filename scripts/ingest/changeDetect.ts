// Change-detection helpers — pure, no I/O (ticket 033).
//
// The ingestion cron fires ~52 times/day; almost every tick is a no-op (no match
// finished or changed since the previous tick). Re-reading all predictions across
// every group and rewriting all match docs on every tick blows the Firebase Spark
// free-tier quota (50K reads/day, 20K writes/day). These helpers let the
// orchestrator decide — from a cheap watermark in `config/meta` — whether the
// expensive global-write and per-group grading passes need to run at all.
//
// Two signatures drive the decision:
//   - `matchSignature`   — every match's status+score+kickoff. Changes ⇒ the
//                          GLOBAL writes (matches/standings/cutoffs) must run.
//   - `finishedSignature` — only FINISHED matches with a real (non-null) score,
//                          keyed by matchId:home-away. Changes ⇒ the per-group
//                          grading + leaderboard pass must run. Keying on the
//                          scoreline means a late SCORE CORRECTION to an
//                          already-FINISHED match also trips it, not just a brand
//                          new finish.
//
// Both signatures are ORDER-INDEPENDENT (the per-match fields are sorted before
// hashing) so the API returning matches in a different order never forces a
// needless full pass.

import type { MatchDoc } from './mapMatch.ts'

/**
 * The watermark block persisted at `config/meta.sig` by the ingestion service
 * account. Absent on the first run after deploy ⇒ treated as a full pass.
 */
export interface IngestSig {
  /** Hash of every match's status+score+kickoff. */
  matches: string
  /** Hash of FINISHED matches' matchId:home-away (non-null score only). */
  finished: string
  /** The SCORING_VERSION the per-group pass last ran at. */
  scoringVersion: number
}

/** The two passes the orchestrator may run this tick. */
export interface PassDecision {
  /** Run the GLOBAL writes (upsert matches, cutoffs, standings). */
  writeGlobals: boolean
  /** Run the per-group grading + leaderboard pass (the expensive reads/writes). */
  gradeAndBoard: boolean
}

/**
 * Deterministic, order-independent hash of a set of per-match field strings.
 * Sorts the lines so input ordering never affects the result, then joins with a
 * separator that cannot appear inside a line. Not a cryptographic hash — just a
 * stable change key for cheap equality checks.
 */
function hashLines(lines: string[]): string {
  return lines.slice().sort().join('|')
}

const kickoffMs = (m: MatchDoc): number =>
  typeof m.kickoff?.toMillis === 'function' ? m.kickoff.toMillis() : 0

/**
 * Signature of every match's status+score+kickoff. Trips the GLOBAL-write pass:
 * when this is unchanged, matches/standings/cutoffs cannot have changed either,
 * so those writes are skipped.
 */
export function matchSignature(matches: MatchDoc[]): string {
  const lines = matches.map(
    (m) => `${m.matchId}:${m.status}:${m.score?.home ?? ''}-${m.score?.away ?? ''}:${kickoffMs(m)}`,
  )
  return hashLines(lines)
}

/**
 * Signature of FINISHED matches that carry a real (non-null) full-time score,
 * keyed by matchId and the scoreline. Trips the per-group grading pass: a new
 * finish OR a score correction to an already-finished match changes it.
 */
export function finishedSignature(matches: MatchDoc[]): string {
  const lines: string[] = []
  for (const m of matches) {
    if (m.status !== 'FINISHED') continue
    if (m.score?.home == null || m.score?.away == null) continue
    lines.push(`${m.matchId}:${m.score.home}-${m.score.away}`)
  }
  return hashLines(lines)
}

/**
 * Decide which passes to run this tick from the freshly-computed signatures, the
 * previously-persisted watermark, and the force flag.
 *
 *   - Absent/empty `prev` ⇒ FULL pass (both true) — safe on first deploy.
 *   - `force` ⇒ FULL pass (both true).
 *   - `writeGlobals` when the match signature changed (or no prev).
 *   - `gradeAndBoard` when the FINISHED signature changed, OR the SCORING_VERSION
 *     differs from the version the per-group pass last ran at (an intentional
 *     re-grade), OR no prev.
 */
export function decidePasses(
  current: { matchSig: string; finishedSig: string; scoringVersion: number },
  prev: Partial<IngestSig> | undefined,
  force: boolean,
): PassDecision {
  // No watermark yet (first run after deploy) ⇒ do everything.
  if (!prev || (prev.matches == null && prev.finished == null && prev.scoringVersion == null)) {
    return { writeGlobals: true, gradeAndBoard: true }
  }

  if (force) {
    return { writeGlobals: true, gradeAndBoard: true }
  }

  const writeGlobals = current.matchSig !== prev.matches
  const versionChanged = current.scoringVersion !== prev.scoringVersion
  const gradeAndBoard = current.finishedSig !== prev.finished || versionChanged

  return { writeGlobals, gradeAndBoard }
}
