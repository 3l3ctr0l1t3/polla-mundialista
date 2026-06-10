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

/* ---------------------------------------------------------------- groups */

/**
 * `groups/{groupId}` — a multi-tenant pool (ticket 012).
 *
 * Any signed-in user can create a group, becoming its **owner**. The owner's
 * membership is DERIVED from `ownerUid` (there is NO `members/{owner}` doc) — see
 * the owner-derived membership model in `firestore.rules`. `inviteCode` backs an
 * unguessable invite link; knowing it only lets a user *request* to join.
 */
export interface Group {
  groupId: string
  name: string
  /** uid of the creator/owner. The owner is implicitly an approved admin (no member doc). */
  ownerUid: string
  /**
   * Owner display name, denormalized onto the group at creation (ticket 013). The owner
   * has NO member doc, so the leaderboard roster reads their name from here to render them
   * alongside member-doc joiners.
   */
  ownerName: string
  /** Owner avatar URL, denormalized at creation (ticket 013); `null` if the owner has none. */
  ownerPhotoURL: string | null
  /** Unguessable token for invite links; approval is still required. */
  inviteCode: string
  createdAt: Timestamp
  /**
   * When/how members may submit predictions (ticket 019). **Absent ⇒ `'lazy'`** — every
   * group created before this ticket has no `mode` field and is treated as lazy (no
   * backfill). A group admin may switch lazy↔strict only until the freeze instant
   * (`config/tournament.firstCupMatchKickoff − 10min`); see `firestore.rules`.
   */
  mode?: PredictionMode
  /**
   * Per-group scoring override (ticket 025). **Absent ⇒ `DEFAULT_SCORING`** — the
   * group's *effective* config is this object merged over the defaults (see
   * `effectiveScoring` in `src/shared/scoring.ts`). Editable by the group owner/admin
   * only until the same freeze instant as `mode`
   * (`config/tournament.firstCupMatchKickoff − 10min`); see `firestore.rules`.
   */
  scoring?: ScoringConfig
}

/**
 * A group's prediction mode (ticket 019):
 *   - `lazy`   — edit each match until **10 min before that match's kickoff** (per match).
 *   - `strict` — two batch windows: ALL group-stage picks lock 10 min before the first cup
 *     match; ALL knockout picks lock 10 min before the first knockout match.
 */
export type PredictionMode = 'lazy' | 'strict'

/* -------------------------------------------------------------- members */

/** A membership request's lifecycle state. */
export type MemberStatus = 'pending' | 'approved' | 'rejected'

/** A member's role within a group. The owner is implicitly `admin` (no member doc). */
export type MemberRole = 'admin' | 'member'

/**
 * `groups/{groupId}/members/{uid}` — a per-group self-enrollment request (ticket 012,
 * generalizes ticket 011's top-level `members`).
 *
 * Member docs exist ONLY for JOINERS. A signed-in user creates their own doc with
 * `role: 'member'`, `status: 'pending'`; a group admin (owner or a `role: 'admin'`
 * approved member) approves/rejects by setting `status` + `decidedBy`/`decidedAt`
 * (and may grant `role: 'admin'`). The group OWNER is NOT represented by a member
 * doc — their membership/admin is derived from `groups/{groupId}.ownerUid`.
 *
 * Membership for that group's predictions is
 * `isOwner(gid) || members/{uid}.status === 'approved'`.
 *
 * `decidedAt`/`decidedBy` are null while pending and may be set ONLY by an admin
 * (enforced in `firestore.rules`). A user may never self-approve.
 */
export interface Member {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  /**
   * Granted by an admin on approval; self-requests must start as 'member'.
   *
   * Optional in TypeScript ONLY to keep the deprecated ticket-011 `MembershipGate`
   * write compiling until Phase B repoints it; the `firestore.rules` REQUIRE
   * `role == 'member'` on a self-request, so a real group member doc always has it.
   */
  role?: MemberRole
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
 * `groups/{groupId}/predictions/{uid}_{matchId}` — one prediction per participant per
 * match, PER GROUP (ticket 012). Same shape as the deprecated top-level
 * `predictions/{uid}_{matchId}` (ticket 006), now nested under a group.
 *
 * `homeGoals`/`awayGoals` are written by the owning client before kickoff (the kickoff
 * lock reads the GLOBAL `matches/{matchId}.kickoff`). `points`/`breakdown` are written
 * ONLY by the ingestion service account after grading; clients may never set or change
 * them (enforced in `firestore.rules`).
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
 * `groups/{groupId}/leaderboard/{uid}` — denormalized standings for a participant,
 * PER GROUP (ticket 012). Same shape as the deprecated top-level `leaderboard/{uid}`,
 * now nested under a group. Written only by the aggregation/ingestion service account;
 * read by that group's members only.
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
  /**
   * When this participant joined the group (ticket 025) — the final leaderboard
   * tie-break key (earliest join wins). For a member it is their `requestedAt`; for
   * the implicit owner it is the group's `createdAt`. Written by the ingestion
   * aggregation so server + client rank identically.
   */
  joinedAt: Timestamp
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

/**
 * `config/tournament` — the two kickoff cutoffs that drive **strict** prediction windows
 * (ticket 019). Written ONLY by the ingestion service account (computed `min(kickoff)`
 * per stage); read by the browser and by `firestore.rules` (which `get()`s it to gate
 * strict-group writes and the group-mode freeze). Clients are read-only.
 */
export interface TournamentConfig {
  /** Kickoff of the first `GROUP_STAGE` match — the cup's first match. */
  firstCupMatchKickoff: Timestamp
  /** Kickoff of the first `LAST_32` (knockout) match. */
  firstKnockoutKickoff: Timestamp
}
