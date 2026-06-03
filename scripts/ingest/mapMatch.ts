// Map a football-data.org v4 match → the Firestore `Match` document shape.
//
// Mirrors `src/shared/types.ts` `Match`, but uses the firebase-admin `Timestamp`
// (the admin SDK and the web SDK have distinct Timestamp classes). The admin
// `Timestamp` class is importable WITHOUT initializing an app or credentials, so
// this mapper is fully unit-testable offline.

import { Timestamp } from 'firebase-admin/firestore'
import type { MatchStatus, MatchStage } from '../../src/shared/types.ts'
import type { FdMatch, FdTeam } from './types.ts'

/** Admin-side Match doc: identical to `Match` but with admin Timestamps. */
export interface MatchDoc {
  matchId: string
  kickoff: Timestamp
  status: MatchStatus
  stage: MatchStage
  group: string | null
  homeTeam: TeamDoc
  awayTeam: TeamDoc
  score: ScoreDoc
  lastUpdated: Timestamp
}

export interface TeamDoc {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string
}

export interface ScoreDoc {
  home: number | null
  away: number | null
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
}

const VALID_STATUSES: ReadonlySet<string> = new Set<MatchStatus>([
  'SCHEDULED',
  'TIMED',
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
  'SUSPENDED',
  'POSTPONED',
  'CANCELLED',
])

const VALID_STAGES: ReadonlySet<string> = new Set<MatchStage>([
  'GROUP_STAGE',
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
])

/** Stable placeholder for a not-yet-determined knockout team. */
function placeholderTeam(side: 'home' | 'away'): TeamDoc {
  return {
    id: -1,
    name: 'TBD',
    shortName: 'TBD',
    tla: side === 'home' ? 'TB1' : 'TB2',
    crest: '',
  }
}

function mapTeam(raw: FdTeam | null | undefined, side: 'home' | 'away'): TeamDoc {
  if (!raw || raw.id == null) return placeholderTeam(side)
  return {
    id: raw.id,
    name: raw.name ?? 'TBD',
    shortName: raw.shortName ?? raw.name ?? 'TBD',
    tla: raw.tla ?? 'TBD',
    crest: raw.crest ?? '',
  }
}

/** football-data "GROUP_A".."GROUP_L" → bare letter "A".."L"; null for knockout. */
function mapGroup(group: string | null | undefined): string | null {
  if (!group) return null
  const m = /^GROUP_([A-L])$/.exec(group)
  return m ? m[1] : null
}

function mapStatus(status: string): MatchStatus {
  return VALID_STATUSES.has(status) ? (status as MatchStatus) : 'SCHEDULED'
}

function mapStage(stage: string): MatchStage {
  return VALID_STAGES.has(stage) ? (stage as MatchStage) : 'GROUP_STAGE'
}

/**
 * Map a raw football-data match into a Firestore `Match` doc.
 * `now` defaults to the current time for `lastUpdated` when the wire payload
 * omits it; pass a fixed value in tests for determinism.
 */
export function mapMatch(raw: FdMatch, now: Date = new Date()): MatchDoc {
  const kickoff = Timestamp.fromDate(new Date(raw.utcDate))
  const lastUpdated = raw.lastUpdated
    ? Timestamp.fromDate(new Date(raw.lastUpdated))
    : Timestamp.fromDate(now)

  const ft = raw.score?.fullTime ?? { home: null, away: null }

  return {
    matchId: String(raw.id),
    kickoff,
    status: mapStatus(raw.status),
    stage: mapStage(raw.stage),
    group: mapGroup(raw.group),
    homeTeam: mapTeam(raw.homeTeam, 'home'),
    awayTeam: mapTeam(raw.awayTeam, 'away'),
    score: {
      home: ft.home ?? null,
      away: ft.away ?? null,
      winner: raw.score?.winner ?? null,
    },
    lastUpdated,
  }
}
