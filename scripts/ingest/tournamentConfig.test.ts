// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { computeTournamentCutoffs } from './tournamentConfig.ts'
import type { MatchDoc } from './mapMatch.ts'

// Minimal MatchDoc fixture — the function only reads `stage` and `kickoff`.
// The rest is filled minimally / cast to keep the test offline and focused.
function match(stage: MatchDoc['stage'], iso: string): MatchDoc {
  return {
    matchId: iso,
    kickoff: Timestamp.fromDate(new Date(iso)),
    status: 'SCHEDULED',
    stage,
    group: null,
    homeTeam: { id: 1, name: 'A', shortName: 'A', tla: 'AAA', crest: '' },
    awayTeam: { id: 2, name: 'B', shortName: 'B', tla: 'BBB', crest: '' },
    score: { home: null, away: null, winner: null },
    lastUpdated: Timestamp.fromDate(new Date(iso)),
  }
}

describe('computeTournamentCutoffs', () => {
  it('selects the earliest GROUP_STAGE kickoff when matches are out of order', () => {
    const matches = [
      match('GROUP_STAGE', '2026-06-15T18:00:00Z'),
      match('GROUP_STAGE', '2026-06-11T19:00:00Z'), // earliest
      match('GROUP_STAGE', '2026-06-12T16:00:00Z'),
    ]
    const cutoffs = computeTournamentCutoffs(matches)
    expect(cutoffs.firstCupMatchKickoff?.toDate().toISOString()).toBe('2026-06-11T19:00:00.000Z')
  })

  it('selects the earliest LAST_32 kickoff independent of group-stage matches', () => {
    const matches = [
      match('GROUP_STAGE', '2026-06-11T19:00:00Z'),
      match('LAST_32', '2026-06-30T20:00:00Z'),
      match('LAST_32', '2026-06-28T16:00:00Z'), // earliest knockout
      match('LAST_32', '2026-06-29T18:00:00Z'),
    ]
    const cutoffs = computeTournamentCutoffs(matches)
    expect(cutoffs.firstCupMatchKickoff?.toDate().toISOString()).toBe('2026-06-11T19:00:00.000Z')
    expect(cutoffs.firstKnockoutKickoff?.toDate().toISOString()).toBe('2026-06-28T16:00:00.000Z')
  })

  it('omits firstKnockoutKickoff when no knockout matches exist yet (group cutoff still returned)', () => {
    const matches = [
      match('GROUP_STAGE', '2026-06-12T16:00:00Z'),
      match('GROUP_STAGE', '2026-06-11T19:00:00Z'),
    ]
    const cutoffs = computeTournamentCutoffs(matches)
    expect(cutoffs.firstCupMatchKickoff?.toDate().toISOString()).toBe('2026-06-11T19:00:00.000Z')
    expect('firstKnockoutKickoff' in cutoffs).toBe(false)
    expect(cutoffs.firstKnockoutKickoff).toBeUndefined()
  })

  it('omits both cutoffs for empty input', () => {
    const cutoffs = computeTournamentCutoffs([])
    expect('firstCupMatchKickoff' in cutoffs).toBe(false)
    expect('firstKnockoutKickoff' in cutoffs).toBe(false)
    expect(cutoffs.firstCupMatchKickoff).toBeUndefined()
    expect(cutoffs.firstKnockoutKickoff).toBeUndefined()
  })

  it('returns the actual admin Timestamp objects (not copies) of the earliest matches', () => {
    const groupEarliest = match('GROUP_STAGE', '2026-06-11T19:00:00Z')
    const knockoutEarliest = match('LAST_32', '2026-06-28T16:00:00Z')
    const matches = [
      match('GROUP_STAGE', '2026-06-15T18:00:00Z'),
      groupEarliest,
      knockoutEarliest,
      match('LAST_32', '2026-06-30T20:00:00Z'),
    ]
    const cutoffs = computeTournamentCutoffs(matches)
    expect(cutoffs.firstCupMatchKickoff).toBe(groupEarliest.kickoff)
    expect(cutoffs.firstKnockoutKickoff).toBe(knockoutEarliest.kickoff)
  })
})
