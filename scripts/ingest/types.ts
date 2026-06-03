// Internal types describing the slice of the football-data.org v4 API responses
// that the ingestion job consumes. These mirror the wire shape (NOT our Firestore
// shape) — `mapMatch.ts` translates them into the `Match` documents we store.
//
// Reference: https://docs.football-data.org/general/v4/index.html
// Endpoints used: GET /v4/competitions/WC/matches?season=2026
//                 GET /v4/competitions/WC/standings?season=2026

/** A team as returned inside a match. Knockout placeholders may have null fields. */
export interface FdTeam {
  id: number | null
  name: string | null
  shortName: string | null
  tla: string | null
  crest: string | null
}

/** A scoreline half (or full-time) on the wire. Goals are null until played. */
export interface FdScoreHalf {
  home: number | null
  away: number | null
}

export interface FdScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
  duration?: string
  fullTime: FdScoreHalf
  halfTime?: FdScoreHalf
  // regularTime/extraTime/penalties may also appear; we grade fullTime only.
}

/** A single match object from /matches. */
export interface FdMatch {
  id: number
  utcDate: string
  status: string
  stage: string
  /** "GROUP_A".."GROUP_L" during groups; null for knockout. */
  group: string | null
  matchday?: number | null
  lastUpdated?: string
  homeTeam: FdTeam
  awayTeam: FdTeam
  score: FdScore
}

/** Top-level /matches response. */
export interface FdMatchesResponse {
  count?: number
  competition?: { id: number; name: string; code: string }
  matches: FdMatch[]
}

/* ----------------------------------------------------------------- standings */

export interface FdStandingRow {
  position: number
  team: FdTeam
  playedGames: number
  won: number
  draw: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export interface FdStandingsTable {
  /** "TOTAL" | "HOME" | "AWAY". We keep TOTAL. */
  type: string
  stage: string
  /** "GROUP_A".."GROUP_L". */
  group: string | null
  table: FdStandingRow[]
}

export interface FdStandingsResponse {
  standings: FdStandingsTable[]
}
