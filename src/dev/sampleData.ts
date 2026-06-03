/**
 * Sample fixtures & standings — DEV/TEST ONLY.
 *
 * Used by component/page tests to render the fixtures and standings UI before the
 * ingestion job (ticket 008) seeds real data into Firestore. This must NOT be wired
 * into the production hooks (`useMatches`/`useStandings`), which read live Firestore.
 *
 * Shapes mirror `src/shared/types.ts` exactly. `Timestamp` is the real Firestore
 * class so `.toDate()` / `.toMillis()` behave like production data.
 */
import { Timestamp } from 'firebase/firestore'
import type { Match, Standing, Team, MetaConfig } from '../shared/types'

const ts = (iso: string): Timestamp => Timestamp.fromDate(new Date(iso))

/* ---------------------------------------------------------------- teams */

const MEX: Team = {
  id: 8233,
  name: 'Mexico',
  shortName: 'Mexico',
  tla: 'MEX',
  crest: 'https://crests.football-data.org/mex.svg',
}
const CAN: Team = {
  id: 8480,
  name: 'Canada',
  shortName: 'Canada',
  tla: 'CAN',
  crest: 'https://crests.football-data.org/can.svg',
}
const USA: Team = {
  id: 1816,
  name: 'United States',
  shortName: 'USA',
  tla: 'USA',
  crest: 'https://crests.football-data.org/usa.svg',
}
const BRA: Team = {
  id: 764,
  name: 'Brazil',
  shortName: 'Brazil',
  tla: 'BRA',
  crest: 'https://crests.football-data.org/bra.svg',
}

/** football-data.org placeholder team for an undecided knockout slot. */
const TBD_TEAM: Team = { id: -1, name: '', shortName: '', tla: '', crest: '' }

/* -------------------------------------------------------------- matches */

/** A FINISHED group-stage opener with a real score. */
export const sampleFinishedMatch: Match = {
  matchId: '500001',
  kickoff: ts('2026-06-11T19:00:00Z'),
  status: 'FINISHED',
  stage: 'GROUP_STAGE',
  group: 'A',
  homeTeam: MEX,
  awayTeam: CAN,
  score: { home: 2, away: 1, winner: 'HOME_TEAM' },
  lastUpdated: ts('2026-06-11T21:00:00Z'),
}

/** A SCHEDULED group-stage fixture, no score yet. */
export const sampleScheduledMatch: Match = {
  matchId: '500002',
  kickoff: ts('2026-06-12T22:00:00Z'),
  status: 'SCHEDULED',
  stage: 'GROUP_STAGE',
  group: 'D',
  homeTeam: USA,
  awayTeam: BRA,
  score: { home: null, away: null, winner: null },
  lastUpdated: ts('2026-06-01T00:00:00Z'),
}

/** An IN_PLAY fixture on the same day as the scheduled one. */
export const sampleLiveMatch: Match = {
  matchId: '500003',
  kickoff: ts('2026-06-12T19:00:00Z'),
  status: 'IN_PLAY',
  stage: 'GROUP_STAGE',
  group: 'B',
  homeTeam: BRA,
  awayTeam: MEX,
  score: { home: 1, away: 0, winner: null },
  lastUpdated: ts('2026-06-12T19:35:00Z'),
}

/** A knockout fixture whose teams are not yet decided -> TBD placeholders. */
export const sampleTbdMatch: Match = {
  matchId: '600001',
  kickoff: ts('2026-06-28T22:00:00Z'),
  status: 'SCHEDULED',
  stage: 'LAST_32',
  group: null,
  homeTeam: TBD_TEAM,
  awayTeam: TBD_TEAM,
  score: { home: null, away: null, winner: null },
  lastUpdated: ts('2026-06-01T00:00:00Z'),
}

/** A few matches spanning two days plus a knockout — enough to prove grouping & states. */
export const sampleMatches: Match[] = [
  sampleFinishedMatch,
  sampleLiveMatch,
  sampleScheduledMatch,
  sampleTbdMatch,
]

/* ------------------------------------------------------------ standings */

export const sampleStanding: Standing = {
  groupId: 'A',
  updatedAt: ts('2026-06-11T21:00:00Z'),
  table: [
    {
      position: 1,
      team: MEX,
      playedGames: 1,
      won: 1,
      draw: 0,
      lost: 0,
      goalsFor: 2,
      goalsAgainst: 1,
      goalDifference: 1,
      points: 3,
    },
    {
      position: 2,
      team: CAN,
      playedGames: 1,
      won: 0,
      draw: 0,
      lost: 1,
      goalsFor: 1,
      goalsAgainst: 2,
      goalDifference: -1,
      points: 0,
    },
  ],
}

export const sampleStandings: Standing[] = [sampleStanding]

/* ---------------------------------------------------------------- meta */

export const sampleMeta: MetaConfig = {
  competition: 'WC',
  season: '2026',
  tournamentStart: ts('2026-06-11T00:00:00Z'),
  tournamentEnd: ts('2026-07-19T00:00:00Z'),
  lastIngestAt: ts(new Date(Date.now() - 5 * 60_000).toISOString()),
}
