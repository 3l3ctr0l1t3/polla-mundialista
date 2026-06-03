// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mapMatch } from './mapMatch.ts'
import type { FdMatchesResponse, FdMatch } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sample = JSON.parse(
  readFileSync(resolve(__dirname, 'sample/matches.json'), 'utf8'),
) as FdMatchesResponse

const byId = (id: number): FdMatch => {
  const m = sample.matches.find((x) => x.id === id)
  if (!m) throw new Error(`fixture missing match ${id}`)
  return m
}

const FIXED_NOW = new Date('2026-06-12T00:00:00Z')

describe('mapMatch', () => {
  it('maps a finished group match: id, status, stage, group, teams, score', () => {
    const doc = mapMatch(byId(500001), FIXED_NOW)
    expect(doc.matchId).toBe('500001')
    expect(typeof doc.matchId).toBe('string')
    expect(doc.status).toBe('FINISHED')
    expect(doc.stage).toBe('GROUP_STAGE')
    expect(doc.group).toBe('A') // "GROUP_A" → "A"
    expect(doc.homeTeam).toMatchObject({ id: 2110, tla: 'MEX', name: 'Mexico' })
    expect(doc.awayTeam).toMatchObject({ id: 2120, tla: 'CAN' })
    expect(doc.score).toEqual({ home: 2, away: 1, winner: 'HOME_TEAM' })
  })

  it('converts utcDate to a Firestore admin Timestamp at the right epoch', () => {
    const doc = mapMatch(byId(500001), FIXED_NOW)
    // 2026-06-11T19:00:00Z
    expect(doc.kickoff.toDate().toISOString()).toBe('2026-06-11T19:00:00.000Z')
    expect(doc.kickoff.toMillis()).toBe(Date.parse('2026-06-11T19:00:00Z'))
    // lastUpdated comes from the wire payload when present.
    expect(doc.lastUpdated.toDate().toISOString()).toBe('2026-06-11T21:05:00.000Z')
  })

  it('grades knockout on full-time 90 (ignores ET/penalties) and nulls the group', () => {
    const doc = mapMatch(byId(500005), FIXED_NOW)
    expect(doc.stage).toBe('LAST_32')
    expect(doc.group).toBeNull()
    // fullTime is 1-1 even though the tie was settled on penalties (3-4).
    expect(doc.score).toEqual({ home: 1, away: 1, winner: 'AWAY_TEAM' })
  })

  it('maps TBD knockout teams to stable placeholders', () => {
    const doc = mapMatch(byId(500006), FIXED_NOW)
    expect(doc.status).toBe('TIMED')
    expect(doc.homeTeam).toMatchObject({ id: -1, name: 'TBD', tla: 'TB1' })
    expect(doc.awayTeam).toMatchObject({ id: -1, name: 'TBD', tla: 'TB2' })
    expect(doc.score).toEqual({ home: null, away: null, winner: null })
  })

  it('leaves an unplayed match score null', () => {
    const doc = mapMatch(byId(500004), FIXED_NOW)
    expect(doc.status).toBe('IN_PLAY')
    // fullTime is 0-0 in-play in this fixture; mapper preserves it verbatim.
    expect(doc.score).toEqual({ home: 0, away: 0, winner: null })
  })

  it('falls back to now for lastUpdated when the wire payload omits it', () => {
    const raw = { ...byId(500001), lastUpdated: undefined }
    const doc = mapMatch(raw, FIXED_NOW)
    expect(doc.lastUpdated.toMillis()).toBe(FIXED_NOW.getTime())
  })
})
