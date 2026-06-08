import { describe, it, expect } from 'vitest'
import {
  effectiveMode,
  lockTimeMs,
  LOCK_BUFFER_MS,
  type TournamentCutoffsMs,
} from './predictionLock'
import type { Match } from './types'

/** A minimal `kickoff`-like stub: only `toMillis()` is consumed by `lockTimeMs`. */
function kickoffAt(ms: number): Match['kickoff'] {
  return { toMillis: () => ms } as Match['kickoff']
}

function makeMatch(stage: Match['stage'], kickoffMs: number): Pick<Match, 'kickoff' | 'stage'> {
  return { stage, kickoff: kickoffAt(kickoffMs) }
}

const CUTOFFS: TournamentCutoffsMs = {
  firstCupMatchKickoffMs: new Date('2026-06-11T20:00:00Z').getTime(),
  firstKnockoutKickoffMs: new Date('2026-06-28T20:00:00Z').getTime(),
}

describe('effectiveMode', () => {
  it('defaults a mode-less group to lazy', () => {
    expect(effectiveMode({})).toBe('lazy')
    expect(effectiveMode({ mode: undefined })).toBe('lazy')
  })

  it('returns the explicit mode when present', () => {
    expect(effectiveMode({ mode: 'lazy' })).toBe('lazy')
    expect(effectiveMode({ mode: 'strict' })).toBe('strict')
  })
})

describe('lockTimeMs', () => {
  const kickoffMs = new Date('2026-06-15T18:00:00Z').getTime()

  it('lazy = that match kickoff − 10min', () => {
    const match = makeMatch('GROUP_STAGE', kickoffMs)
    expect(lockTimeMs(match, 'lazy', CUTOFFS)).toBe(kickoffMs - LOCK_BUFFER_MS)
    // Without cutoffs lazy is identical.
    expect(lockTimeMs(match, 'lazy')).toBe(kickoffMs - LOCK_BUFFER_MS)
  })

  it('strict GROUP_STAGE = firstCupMatchKickoff − 10min (independent of match kickoff)', () => {
    const match = makeMatch('GROUP_STAGE', kickoffMs)
    expect(lockTimeMs(match, 'strict', CUTOFFS)).toBe(
      CUTOFFS.firstCupMatchKickoffMs - LOCK_BUFFER_MS,
    )
  })

  it('strict knockout = firstKnockoutKickoff − 10min (independent of match kickoff)', () => {
    // A FINAL kicking off weeks later still locks at the first knockout window.
    const finalKickoff = new Date('2026-07-19T18:00:00Z').getTime()
    const match = makeMatch('LAST_32', finalKickoff)
    expect(lockTimeMs(match, 'strict', CUTOFFS)).toBe(
      CUTOFFS.firstKnockoutKickoffMs - LOCK_BUFFER_MS,
    )
  })

  it('strict WITHOUT cutoffs falls back to the lazy formula (kickoff − 10min)', () => {
    const match = makeMatch('GROUP_STAGE', kickoffMs)
    expect(lockTimeMs(match, 'strict')).toBe(kickoffMs - LOCK_BUFFER_MS)
  })
})
