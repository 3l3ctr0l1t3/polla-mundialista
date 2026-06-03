/**
 * Typed Firestore access for Polla Mundialista.
 *
 * Exposes the initialized `db` and one `FirestoreDataConverter<T>` + typed collection
 * reference per collection, so app code reads/writes the shapes declared in
 * `src/shared/types.ts` without per-call casting.
 *
 * Converters are intentionally light: they pass document data through with the correct
 * static type. They do NOT mutate or validate — the authoritative validation lives in
 * `firestore.rules` (server-side) and the scoring engine (ticket 006).
 */
import {
  getFirestore,
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { app } from './config'
import type {
  User,
  Group,
  Member,
  Match,
  Prediction,
  LeaderboardEntry,
  Standing,
  ScoringConfigDoc,
  AllowlistConfig,
  MetaConfig,
} from '../shared/types'

export const db = getFirestore(app)

/** Build a pass-through converter that stamps the static type `T` onto reads/writes. */
function makeConverter<T>(): FirestoreDataConverter<T> {
  return {
    toFirestore(value: T) {
      return value as Record<string, unknown>
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return snapshot.data() as T
    },
  }
}

export const userConverter = makeConverter<User>()
export const groupConverter = makeConverter<Group>()
export const memberConverter = makeConverter<Member>()
export const matchConverter = makeConverter<Match>()
export const predictionConverter = makeConverter<Prediction>()
export const leaderboardConverter = makeConverter<LeaderboardEntry>()
export const standingConverter = makeConverter<Standing>()
export const scoringConfigConverter = makeConverter<ScoringConfigDoc>()
export const allowlistConfigConverter = makeConverter<AllowlistConfig>()
export const metaConfigConverter = makeConverter<MetaConfig>()

/* --------------------------------------------------- typed collection refs */

export const usersCol: CollectionReference<User> = collection(db, 'users').withConverter(
  userConverter,
)

export const matchesCol: CollectionReference<Match> = collection(db, 'matches').withConverter(
  matchConverter,
)

export const standingsCol: CollectionReference<Standing> = collection(
  db,
  'standings',
).withConverter(standingConverter)

/* -------------------------------------------------- groups (ticket 012) */
// Multi-tenant: membership, predictions, and leaderboards now live UNDER a group.
// `matches`/`standings`/`config` stay global. The owner is implicit (groups/{gid}.ownerUid);
// member docs exist only for joiners.

export const groupsCol: CollectionReference<Group> = collection(db, 'groups').withConverter(
  groupConverter,
)

export const groupDoc = (gid: string): DocumentReference<Group> => doc(groupsCol, gid)

/** `groups/{gid}/members` — joiners only (the owner is implicit via `ownerUid`). */
export const groupMembersCol = (gid: string): CollectionReference<Member> =>
  collection(db, 'groups', gid, 'members').withConverter(memberConverter)

export const groupMemberDoc = (gid: string, uid: string): DocumentReference<Member> =>
  doc(groupMembersCol(gid), uid)

/** `groups/{gid}/predictions` — per-group predictions, keyed `{uid}_{matchId}`. */
export const groupPredictionsCol = (gid: string): CollectionReference<Prediction> =>
  collection(db, 'groups', gid, 'predictions').withConverter(predictionConverter)

export const groupPredictionDoc = (
  gid: string,
  uid: string,
  matchId: string,
): DocumentReference<Prediction> => doc(groupPredictionsCol(gid), predictionId(uid, matchId))

/** `groups/{gid}/leaderboard` — per-group aggregate (admin SDK writes only). */
export const groupLeaderboardCol = (gid: string): CollectionReference<LeaderboardEntry> =>
  collection(db, 'groups', gid, 'leaderboard').withConverter(leaderboardConverter)

export const groupLeaderboardDoc = (
  gid: string,
  uid: string,
): DocumentReference<LeaderboardEntry> => doc(groupLeaderboardCol(gid), uid)

/* ----------------------------------------------------------- doc helpers */

/** Deterministic prediction doc id: `{uid}_{matchId}`. */
export const predictionId = (uid: string, matchId: string): string => `${uid}_${matchId}`

export const userDoc = (uid: string): DocumentReference<User> => doc(usersCol, uid)

export const matchDoc = (matchId: string): DocumentReference<Match> => doc(matchesCol, matchId)

export const standingDoc = (groupId: string): DocumentReference<Standing> =>
  doc(standingsCol, groupId)

/* ------------------------------------------ DEPRECATED top-level refs (012) */
/**
 * @deprecated Ticket 012 moved membership, predictions, and leaderboards UNDER a group.
 * These top-level collections are no longer written/read by the security rules and carry
 * no data. They remain ONLY as build-time aliases so Phase B/C UI imports keep compiling
 * until those phases repoint to the `group*` refs above. Do not use in new code:
 *   - `membersCol` / `memberDoc`     -> `groupMembersCol(gid)` / `groupMemberDoc(gid, uid)`
 *   - `predictionsCol` / `predictionDoc` -> `groupPredictionsCol(gid)` / `groupPredictionDoc(gid, uid, matchId)`
 *   - `leaderboardCol` / `leaderboardDoc` -> `groupLeaderboardCol(gid)` / `groupLeaderboardDoc(gid, uid)`
 */
export const membersCol: CollectionReference<Member> = collection(db, 'members').withConverter(
  memberConverter,
)

/** @deprecated see {@link groupMemberDoc}. */
export const memberDoc = (uid: string): DocumentReference<Member> => doc(membersCol, uid)

/** @deprecated see {@link groupPredictionsCol}. */
export const predictionsCol: CollectionReference<Prediction> = collection(
  db,
  'predictions',
).withConverter(predictionConverter)

/** @deprecated see {@link groupPredictionDoc}. */
export const predictionDoc = (uid: string, matchId: string): DocumentReference<Prediction> =>
  doc(predictionsCol, predictionId(uid, matchId))

/** @deprecated see {@link groupLeaderboardCol}. */
export const leaderboardCol: CollectionReference<LeaderboardEntry> = collection(
  db,
  'leaderboard',
).withConverter(leaderboardConverter)

/** @deprecated see {@link groupLeaderboardDoc}. */
export const leaderboardDoc = (uid: string): DocumentReference<LeaderboardEntry> =>
  doc(leaderboardCol, uid)

/* --------------------------------------------------------------- config */

export const scoringConfigDoc = (): DocumentReference<ScoringConfigDoc> =>
  doc(db, 'config', 'scoring').withConverter(scoringConfigConverter)

export const allowlistConfigDoc = (): DocumentReference<AllowlistConfig> =>
  doc(db, 'config', 'allowlist').withConverter(allowlistConfigConverter)

export const metaConfigDoc = (): DocumentReference<MetaConfig> =>
  doc(db, 'config', 'meta').withConverter(metaConfigConverter)
