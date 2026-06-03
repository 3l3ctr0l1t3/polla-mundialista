/**
 * Firestore document shapes for Polla Mundialista.
 *
 * These interfaces are the single source of truth for the data model. The typed
 * converters in `src/firebase/db.ts` map Firestore documents to/from these shapes,
 * and `firestore.rules` enforces the same invariants on the server.
 *
 * `ScoringConfig` is owned by the scoring engine (ticket 006, `src/shared/scoring.ts`)
 * and is imported here — never redefined.
 */
import type { Timestamp } from 'firebase/firestore'
import type { ScoringConfig } from './scoring'

/* ------------------------------------------------------------------ users */

/** `users/{uid}` — a participant's profile. `isAdmin` is set out-of-band (admin SDK) and never by the client. */
export interface User {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  /** Admin flag — only ever written by the admin SDK; clients may never set/change it. */
  isAdmin: boolean
  createdAt: Timestamp
}

/* -------------------------------------------------------------- members */

/** A membership request's lifecycle state. */
export type MemberStatus = 'pending' | 'approved' | 'rejected'

/**
 * `members/{uid}` — a self-enrollment request (ticket 011).
 *
 * A signed-in user creates their own doc with `status: 'pending'`; an admin
 * approves/rejects it by setting `status` + `decidedBy`/`decidedAt`. Membership
 * for predictions is `isAdmin || members/{uid}.status === 'approved'`. This
 * replaces the deprecated `config/allowlist`.
 *
 * `decidedAt`/`decidedBy` are null while pending and may be set ONLY by an admin
 * (enforced in `firestore.rules`). A user may never self-approve.
 */
export interface Member {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  status: MemberStatus
  requestedAt: Timestamp
  /** When an admin decided (approved/rejected); null while pending. */
  decidedAt: Timestamp | null
  /** uid of the admin who decided; null while pending. */
  decidedBy: string | null
}

/* ---------------------------------------------------------------- matches */

/** football-data.org match lifecycle states we care about. */
export type MatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELLED'

/** Tournament stage as reported by football-data.org. */
export type MatchStage =
  | 'GROUP_STAGE'
  | 'LAST_32'
  | 'LAST_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'THIRD_PLACE'
  | 'FINAL'

/** Denormalized team snapshot embedded in a match. */
export interface Team {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string
}

/** Match result. `null` until the match has been played; `winner` set when FINISHED. */
export interface Score {
  home: number | null
  away: number | null
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
}

/**
 * `matches/{matchId}` — `matchId` is the football-data.org id rendered as a string.
 * Written only by the ingestion service account (admin SDK); clients read-only.
 */
export interface Match {
  matchId: string
  kickoff: Timestamp
  status: MatchStatus
  stage: MatchStage
  /** Group letter (A–L) during the group stage; `null` for knockout matches. */
  group: string | null
  homeTeam: Team
  awayTeam: Team
  score: Score
  lastUpdated: Timestamp
}

/* ------------------------------------------------------------ predictions */

/** Per-tier points awarded to a prediction. Mirrors the breakdown returned by `scorePrediction` (ticket 006). */
export interface ScoreBreakdown {
  exact: number
  outcome: number
  goalDiff: number
}

/**
 * `predictions/{uid}_{matchId}` — one prediction per participant per match.
 *
 * `homeGoals`/`awayGoals` are written by the owning client before kickoff.
 * `points`/`breakdown` are written ONLY by the ingestion service account after grading;
 * clients may never set or change them (enforced in `firestore.rules`).
 */
export interface Prediction {
  uid: string
  matchId: string
  homeGoals: number
  awayGoals: number
  createdAt: Timestamp
  updatedAt: Timestamp
  /** Awarded points — ingestion only. */
  points?: number
  /** Per-tier breakdown — ingestion only. */
  breakdown?: ScoreBreakdown
}

/* ----------------------------------------------------------- leaderboard */

/**
 * `leaderboard/{uid}` — denormalized standings for a participant.
 * Written only by the aggregation/ingestion service account; clients read-only.
 */
export interface LeaderboardEntry {
  uid: string
  displayName: string
  photoURL: string | null
  totalPoints: number
  exactCount: number
  outcomeCount: number
  predictionsGraded: number
  rank: number
  updatedAt: Timestamp
}

/* ------------------------------------------------------------- standings */

/** A single team's row within a group's standings table. */
export interface StandingRow {
  position: number
  team: Team
  playedGames: number
  won: number
  draw: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

/**
 * `standings/{groupId}` — group table (groupId = group letter A–L).
 * Written only by the ingestion service account; clients read-only.
 */
export interface Standing {
  groupId: string
  table: StandingRow[]
  updatedAt: Timestamp
}

/* ---------------------------------------------------------------- config */

/** `config/scoring` — the scoring weights/policy. Shape owned by ticket 006. */
export type ScoringConfigDoc = ScoringConfig

/**
 * `config/allowlist` — emails permitted to join the pool.
 *
 * @deprecated Superseded by the `members/{uid}` request→approve model (ticket 011).
 * No longer consulted by `firestore.rules` or the app; retained only for historical
 * reads. Safe to delete once no client references it.
 */
export interface AllowlistConfig {
  emails: string[]
}

/** `config/meta` — tournament-wide metadata. */
export interface MetaConfig {
  competition: string
  season: string
  tournamentStart: Timestamp
  tournamentEnd: Timestamp
  lastIngestAt: Timestamp | null
}
