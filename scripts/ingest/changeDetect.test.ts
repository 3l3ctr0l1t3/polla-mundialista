// @vitest-environment node
//
// Pure unit tests for the change-detection helpers (ticket 033). No I/O, no
// Firestore — just the signature functions and the `decidePasses` truth table.

import { describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { matchSignature, finishedSignature, decidePasses, type IngestSig } from './changeDetect.ts'
import type { MatchDoc } from './mapMatch.ts'

// ---- Minimal MatchDoc factory (only the fields the signatures read). ----
let seq = 0
function match(over: Partial<MatchDoc> & { matchId?: string } = {}): MatchDoc {
  const matchId = over.matchId ?? String(500000 + seq++)
  return {
    matchId,
    kickoff: Timestamp.fromMillis(1_700_000_000_000),
    status: 'SCHEDULED',
    stage: 'GROUP_STAGE',
    group: 'A',
    homeTeam: { id: 1, name: 'H', shortName: 'H', tla: 'HHH', crest: '' },
    awayTeam: { id: 2, name: 'A', shortName: 'A', tla: 'AAA', crest: '' },
    score: { home: null, away: null, winner: null },
    lastUpdated: Timestamp.fromMillis(1_700_000_000_000),
    ...over,
  }
}

function finished(matchId: string, home: number, away: number): MatchDoc {
  return match({
    matchId,
    status: 'FINISHED',
    score: { home, away, winner: home > away ? 'HOME_TEAM' : home < away ? 'AWAY_TEAM' : 'DRAW' },
  })
}

describe('matchSignature', () => {
  it('is deterministic for the same input', () => {
    const a = [finished('1', 2, 1), match({ matchId: '2', status: 'TIMED' })]
    expect(matchSignature(a)).toBe(matchSignature(a))
  })

  it('is order-independent', () => {
    const m1 = finished('1', 2, 1)
    const m2 = match({ matchId: '2', status: 'TIMED' })
    expect(matchSignature([m1, m2])).toBe(matchSignature([m2, m1]))
  })

  it('changes when a status changes', () => {
    const before = [match({ matchId: '1', status: 'TIMED' })]
    const after = [match({ matchId: '1', status: 'IN_PLAY' })]
    expect(matchSignature(after)).not.toBe(matchSignature(before))
  })

  it('changes when a score changes', () => {
    const before = [finished('1', 2, 1)]
    const after = [finished('1', 3, 1)]
    expect(matchSignature(after)).not.toBe(matchSignature(before))
  })

  it('changes when a kickoff changes', () => {
    const before = [match({ matchId: '1' })]
    const after = [match({ matchId: '1', kickoff: Timestamp.fromMillis(1_800_000_000_000) })]
    expect(matchSignature(after)).not.toBe(matchSignature(before))
  })
})

describe('finishedSignature', () => {
  it('is order-independent', () => {
    const a = finished('1', 2, 1)
    const b = finished('2', 0, 0)
    expect(finishedSignature([a, b])).toBe(finishedSignature([b, a]))
  })

  it('ignores non-FINISHED matches', () => {
    const justFinished = [finished('1', 2, 1)]
    const withInPlay = [finished('1', 2, 1), match({ matchId: '2', status: 'IN_PLAY' })]
    expect(finishedSignature(withInPlay)).toBe(finishedSignature(justFinished))
  })

  it('ignores FINISHED matches with a null score', () => {
    const nullScore = match({ matchId: '9', status: 'FINISHED' }) // score.home/away null
    expect(finishedSignature([nullScore])).toBe(finishedSignature([]))
  })

  it('changes when a new match finishes', () => {
    const before = [finished('1', 2, 1)]
    const after = [finished('1', 2, 1), finished('2', 0, 0)]
    expect(finishedSignature(after)).not.toBe(finishedSignature(before))
  })

  it('changes when an already-finished match has its score corrected', () => {
    const before = [finished('1', 2, 1)]
    const after = [finished('1', 2, 0)] // late correction
    expect(finishedSignature(after)).not.toBe(finishedSignature(before))
  })

  it('does NOT change for a status-only change with no new finish', () => {
    // A TIMED → IN_PLAY transition does not touch the FINISHED set.
    const before = [finished('1', 2, 1), match({ matchId: '2', status: 'TIMED' })]
    const after = [finished('1', 2, 1), match({ matchId: '2', status: 'IN_PLAY' })]
    expect(finishedSignature(after)).toBe(finishedSignature(before))
  })
})

describe('decidePasses', () => {
  const SV = 2
  const baseMatches = [finished('1', 2, 1), match({ matchId: '2', status: 'TIMED' })]
  const matchSig = matchSignature(baseMatches)
  const finishedSig = finishedSignature(baseMatches)
  const prev: IngestSig = { matches: matchSig, finished: finishedSig, scoringVersion: SV }

  it('absent prev ⇒ full pass (both true)', () => {
    expect(decidePasses({ matchSig, finishedSig, scoringVersion: SV }, undefined, false)).toEqual({
      writeGlobals: true,
      gradeAndBoard: true,
    })
  })

  it('empty prev ⇒ full pass (both true)', () => {
    expect(decidePasses({ matchSig, finishedSig, scoringVersion: SV }, {}, false)).toEqual({
      writeGlobals: true,
      gradeAndBoard: true,
    })
  })

  it('no-op tick ⇒ both false', () => {
    expect(decidePasses({ matchSig, finishedSig, scoringVersion: SV }, prev, false)).toEqual({
      writeGlobals: false,
      gradeAndBoard: false,
    })
  })

  it('a new finish ⇒ gradeAndBoard true (and writeGlobals true, since matches changed)', () => {
    const next = [...baseMatches, finished('3', 1, 0)]
    const decision = decidePasses(
      { matchSig: matchSignature(next), finishedSig: finishedSignature(next), scoringVersion: SV },
      prev,
      false,
    )
    expect(decision.gradeAndBoard).toBe(true)
    expect(decision.writeGlobals).toBe(true)
  })

  it('a score correction to an already-finished match ⇒ gradeAndBoard true', () => {
    const next = [finished('1', 2, 0), match({ matchId: '2', status: 'TIMED' })]
    const decision = decidePasses(
      { matchSig: matchSignature(next), finishedSig: finishedSignature(next), scoringVersion: SV },
      prev,
      false,
    )
    expect(decision.gradeAndBoard).toBe(true)
  })

  it('status-only change with no new finish ⇒ writeGlobals true, gradeAndBoard false', () => {
    const next = [finished('1', 2, 1), match({ matchId: '2', status: 'IN_PLAY' })]
    const decision = decidePasses(
      { matchSig: matchSignature(next), finishedSig: finishedSignature(next), scoringVersion: SV },
      prev,
      false,
    )
    expect(decision).toEqual({ writeGlobals: true, gradeAndBoard: false })
  })

  it('force ⇒ both true even on a no-op tick', () => {
    expect(decidePasses({ matchSig, finishedSig, scoringVersion: SV }, prev, true)).toEqual({
      writeGlobals: true,
      gradeAndBoard: true,
    })
  })

  it('version bump ⇒ gradeAndBoard true despite unchanged finishedSig', () => {
    const decision = decidePasses({ matchSig, finishedSig, scoringVersion: SV + 1 }, prev, false)
    expect(decision.gradeAndBoard).toBe(true)
    // matchSig unchanged ⇒ globals stay skipped.
    expect(decision.writeGlobals).toBe(false)
  })
})
