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

export const membersCol: CollectionReference<Member> = collection(db, 'members').withConverter(
  memberConverter,
)

export const matchesCol: CollectionReference<Match> = collection(db, 'matches').withConverter(
  matchConverter,
)

export const predictionsCol: CollectionReference<Prediction> = collection(
  db,
  'predictions',
).withConverter(predictionConverter)

export const leaderboardCol: CollectionReference<LeaderboardEntry> = collection(
  db,
  'leaderboard',
).withConverter(leaderboardConverter)

export const standingsCol: CollectionReference<Standing> = collection(
  db,
  'standings',
).withConverter(standingConverter)

/* ----------------------------------------------------------- doc helpers */

/** Deterministic prediction doc id: `{uid}_{matchId}`. */
export const predictionId = (uid: string, matchId: string): string => `${uid}_${matchId}`

export const userDoc = (uid: string): DocumentReference<User> => doc(usersCol, uid)

/** `members/{uid}` — the user's own enrollment request (one per user). */
export const memberDoc = (uid: string): DocumentReference<Member> => doc(membersCol, uid)

export const matchDoc = (matchId: string): DocumentReference<Match> => doc(matchesCol, matchId)

export const predictionDoc = (uid: string, matchId: string): DocumentReference<Prediction> =>
  doc(predictionsCol, predictionId(uid, matchId))

export const leaderboardDoc = (uid: string): DocumentReference<LeaderboardEntry> =>
  doc(leaderboardCol, uid)

export const standingDoc = (groupId: string): DocumentReference<Standing> =>
  doc(standingsCol, groupId)

/* --------------------------------------------------------------- config */

export const scoringConfigDoc = (): DocumentReference<ScoringConfigDoc> =>
  doc(db, 'config', 'scoring').withConverter(scoringConfigConverter)

export const allowlistConfigDoc = (): DocumentReference<AllowlistConfig> =>
  doc(db, 'config', 'allowlist').withConverter(allowlistConfigConverter)

export const metaConfigDoc = (): DocumentReference<MetaConfig> =>
  doc(db, 'config', 'meta').withConverter(metaConfigConverter)
