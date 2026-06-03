/**
 * useMyGroups — the signed-in user's groups across the tenant (ticket 012).
 *
 * Three live slices, each driven by an `onSnapshot` listener:
 *   - `owned`    — `groups where ownerUid == me` (the user is the implicit admin).
 *   - `approved` — groups where the user has an APPROVED member doc.
 *   - `pending`  — groups where the user has a PENDING member doc (awaiting approval).
 *
 * Joined groups are discovered with a `members` COLLECTION-GROUP query filtered to
 * `uid == me` (each returned member doc is the user's OWN, so it is readable), then the
 * parent `groups/{gid}` doc is loaded for display. Rejected requests are not surfaced
 * here (the user re-requests from the group's join page).
 *
 * NOTE (index): the `members` collection-group query on `uid` requires a Firestore
 * single-field collection-group index on `members.uid` — flagged in the ticket report.
 *
 * All listeners are cleaned up on unmount / uid change.
 */
import { useEffect, useState } from 'react'
import {
  collectionGroup,
  getDoc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db, groupsCol, groupDoc, memberConverter } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import type { Group, Member } from '../shared/types'

/** A group the user has joined (or requested to join), with the relevant member doc. */
export interface JoinedGroup {
  group: Group
  member: Member
}

export interface UseMyGroupsResult {
  /** Groups the user owns (implicit admin). */
  owned: Group[]
  /** Groups the user has an APPROVED membership in. */
  approved: JoinedGroup[]
  /** Groups the user has a PENDING request in. */
  pending: JoinedGroup[]
  loading: boolean
  error: Error | null
}

export function useMyGroups(): UseMyGroupsResult {
  const { user } = useAuth()
  const uid = user?.uid ?? null

  const [owned, setOwned] = useState<Group[]>([])
  const [joined, setJoined] = useState<JoinedGroup[]>([])
  const [ownedLoaded, setOwnedLoaded] = useState(false)
  const [joinedLoaded, setJoinedLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Owned groups.
  useEffect(() => {
    setOwned([])
    setOwnedLoaded(false)
    if (!uid) {
      setOwnedLoaded(true)
      return
    }
    const q = query(groupsCol, where('ownerUid', '==', uid))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setOwned(snap.docs.map((d) => d.data()))
        setOwnedLoaded(true)
      },
      (err) => {
        setError(err)
        setOwnedLoaded(true)
      },
    )
    return unsubscribe
  }, [uid])

  // Joined / pending groups via the members collection-group query.
  useEffect(() => {
    setJoined([])
    setJoinedLoaded(false)
    if (!uid) {
      setJoinedLoaded(true)
      return
    }

    const q = query(collectionGroup(db, 'members'), where('uid', '==', uid)).withConverter(
      memberConverter,
    )
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const run = async () => {
          const rows = await Promise.all(
            snap.docs.map(async (d: QueryDocumentSnapshot<Member, DocumentData>) => {
              const member = d.data()
              // The member doc lives at groups/{gid}/members/{uid}.
              const gid = d.ref.parent.parent?.id
              if (!gid) return null
              try {
                const groupSnap = await getDoc(groupDoc(gid))
                if (!groupSnap.exists()) return null
                return { group: groupSnap.data(), member } satisfies JoinedGroup
              } catch {
                return null
              }
            }),
          )
          setJoined(rows.filter((r): r is JoinedGroup => r !== null))
          setJoinedLoaded(true)
        }
        void run()
      },
      (err) => {
        setError(err)
        setJoinedLoaded(true)
      },
    )
    return unsubscribe
  }, [uid])

  const approved = joined.filter((j) => j.member.status === 'approved')
  const pending = joined.filter((j) => j.member.status === 'pending')

  return {
    owned,
    approved,
    pending,
    loading: !ownedLoaded || !joinedLoaded,
    error,
  }
}

export default useMyGroups
