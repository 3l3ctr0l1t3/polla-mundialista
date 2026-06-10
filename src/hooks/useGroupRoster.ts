/**
 * useGroupRoster — the FULL ranked roster for a group (ticket 013).
 *
 * The leaderboard must show EVERY participant — all approved members plus the owner —
 * each with their points (0 if none yet), live as membership changes, independent of
 * when ingestion last graded. So this hook merges two live sources:
 *
 *   1. `groups/{gid}/members where status == 'approved'` — the joiners (live `onSnapshot`).
 *   2. The owner, denormalized onto `groups/{gid}` as `ownerUid`/`ownerName`/`ownerPhotoURL`
 *      (the owner has NO member doc), supplied here from `useGroup()`.
 *
 * It then folds in points from `groups/{gid}/leaderboard` (an `onSnapshot` written only by
 * ingestion, per the two-writers rule), defaulting to 0 for anyone not yet graded. The
 * result is a ranked list over the full roster: sorted by totalPoints desc, then exact,
 * outcome, then earliest join time (ascending); dense-ranked (ties share a rank, surfaced
 * as "T-N" by the UI). This tie-break chain matches the server (ingestion) EXACTLY so the
 * client and persisted leaderboard rank identically (ticket 025).
 *
 * Listeners are torn down on unmount / gid change. READ-ONLY: never writes.
 */
import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { groupLeaderboardCol, groupMembersCol } from '../firebase/db'
import { useGroup } from '../group/useGroup'
import type { Group, LeaderboardEntry, Member } from '../shared/types'

/** A single participant row over the full roster — points default to 0 when ungraded. */
export interface RosterEntry {
  uid: string
  displayName: string
  photoURL: string | null
  totalPoints: number
  exactCount: number
  outcomeCount: number
  /** Dense rank (1-based); ties share a rank. */
  rank: number
  /** True when more than one entry shares this rank. */
  isTie: boolean
  /** True for the group owner (derived from the group doc, not a member doc). */
  isOwner: boolean
  /**
   * Join time in epoch ms — the final tie-break key (earliest wins), matching the
   * server. Taken from the persisted leaderboard `joinedAt` when graded, else from the
   * member's `requestedAt` / the owner's group `createdAt`.
   */
  joinedAtMs: number
}

export interface UseGroupRosterResult {
  /** Full roster, ranked. Always contains at least the owner once the group has loaded. */
  roster: RosterEntry[]
  loading: boolean
  error: Error | null
}

/** Rank the merged roster: points desc, then exact, outcome, then earliest join time asc. */
function rankRoster(rows: Omit<RosterEntry, 'rank' | 'isTie'>[]): RosterEntry[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount
    if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount
    return a.joinedAtMs - b.joinedAtMs
  })

  // Dense rank: a row ties the previous one when all ranking keys are equal.
  const sameRank = (
    a: Omit<RosterEntry, 'rank' | 'isTie'>,
    b: Omit<RosterEntry, 'rank' | 'isTie'>,
  ) =>
    a.totalPoints === b.totalPoints &&
    a.exactCount === b.exactCount &&
    a.outcomeCount === b.outcomeCount

  const withRank: RosterEntry[] = []
  let currentRank = 0
  sorted.forEach((row, i) => {
    if (i === 0 || !sameRank(row, sorted[i - 1])) currentRank += 1
    withRank.push({ ...row, rank: currentRank, isTie: false })
  })

  // Mark ties: any rank shared by more than one entry.
  const counts = new Map<number, number>()
  for (const r of withRank) counts.set(r.rank, (counts.get(r.rank) ?? 0) + 1)
  return withRank.map((r) => ({ ...r, isTie: (counts.get(r.rank) ?? 0) > 1 }))
}

/**
 * Merge the approved members + owner with leaderboard points, then rank. The owner is
 * always included from the group fields; if they also appear in the leaderboard or as a
 * member doc, the owner identity wins and we de-dupe by uid.
 */
function buildRoster(
  group: Group | null,
  members: Member[],
  points: Map<string, LeaderboardEntry>,
): RosterEntry[] {
  const byUid = new Map<string, Omit<RosterEntry, 'rank' | 'isTie'>>()

  const pointsFor = (uid: string) => {
    const p = points.get(uid)
    return {
      totalPoints: p?.totalPoints ?? 0,
      exactCount: p?.exactCount ?? 0,
      outcomeCount: p?.outcomeCount ?? 0,
    }
  }

  // Join time = persisted leaderboard `joinedAt` (matches the server) when graded; else
  // the member's `requestedAt` / the owner's group `createdAt` so ungraded rows still sort.
  const joinedAtMsFor = (uid: string, fallback: { toMillis: () => number } | null) => {
    const persisted = points.get(uid)?.joinedAt
    if (persisted) return persisted.toMillis()
    return fallback ? fallback.toMillis() : Number.POSITIVE_INFINITY
  }

  // Approved members first.
  for (const m of members) {
    byUid.set(m.uid, {
      uid: m.uid,
      displayName: m.displayName,
      photoURL: m.photoURL,
      isOwner: false,
      joinedAtMs: joinedAtMsFor(m.uid, m.requestedAt ?? null),
      ...pointsFor(m.uid),
    })
  }

  // The owner has no member doc — fold them in from the group fields. The owner wins on
  // de-dupe (overwrites any stray member/leaderboard identity for that uid).
  if (group) {
    byUid.set(group.ownerUid, {
      uid: group.ownerUid,
      displayName: group.ownerName,
      photoURL: group.ownerPhotoURL,
      isOwner: true,
      joinedAtMs: joinedAtMsFor(group.ownerUid, group.createdAt ?? null),
      ...pointsFor(group.ownerUid),
    })
  }

  return rankRoster([...byUid.values()])
}

export function useGroupRoster(gid: string): UseGroupRosterResult {
  const { group } = useGroup()
  const [members, setMembers] = useState<Member[]>([])
  const [points, setPoints] = useState<Map<string, LeaderboardEntry>>(new Map())
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [pointsLoaded, setPointsLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!gid) {
      setMembers([])
      setMembersLoaded(true)
      return
    }
    setMembersLoaded(false)
    const q = query(groupMembersCol(gid), where('status', '==', 'approved'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setMembers(snap.docs.map((d) => d.data()))
        setError(null)
        setMembersLoaded(true)
      },
      (err) => {
        setError(err)
        setMembersLoaded(true)
      },
    )
    return unsubscribe
  }, [gid])

  useEffect(() => {
    if (!gid) {
      setPoints(new Map())
      setPointsLoaded(true)
      return
    }
    setPointsLoaded(false)
    const unsubscribe = onSnapshot(
      groupLeaderboardCol(gid),
      (snap) => {
        const next = new Map<string, LeaderboardEntry>()
        snap.docs.forEach((d) => next.set(d.id, d.data()))
        setPoints(next)
        setError(null)
        setPointsLoaded(true)
      },
      (err) => {
        setError(err)
        setPointsLoaded(true)
      },
    )
    return unsubscribe
  }, [gid])

  const roster = useMemo(() => buildRoster(group, members, points), [group, members, points])

  return { roster, loading: !membersLoaded || !pointsLoaded, error }
}

export default useGroupRoster
