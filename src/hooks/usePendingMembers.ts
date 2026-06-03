/**
 * usePendingMembers — live list of pending join requests for a group (ticket 012).
 *
 * Subscribes to `groups/{gid}/members` where `status == 'pending'` via `onSnapshot`,
 * ordered by `requestedAt` ascending (oldest first). The listener is cleaned up on
 * unmount / gid change.
 *
 * Only that group's admin can read other users' member docs (enforced by
 * `firestore.rules`); a non-admin subscription resolves to a permission error,
 * surfaced via `error`.
 */
import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { groupMembersCol } from '../firebase/db'
import type { Member } from '../shared/types'

export interface UsePendingMembersResult {
  members: Member[]
  loading: boolean
  error: Error | null
}

export function usePendingMembers(gid: string): UsePendingMembersResult {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!gid) {
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      groupMembersCol(gid),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'asc'),
    )
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setMembers(snap.docs.map((d) => d.data()))
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [gid])

  return { members, loading, error }
}

export default usePendingMembers
