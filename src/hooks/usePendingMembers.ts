/**
 * usePendingMembers — live list of pending join requests for the admin page (ticket 011).
 *
 * Subscribes to `members` where `status == 'pending'` via `onSnapshot`, ordered by
 * `requestedAt` ascending (oldest first). The listener is cleaned up on unmount.
 *
 * Only an admin can read other users' member docs (enforced by `firestore.rules`); a
 * non-admin subscription resolves to a permission error, surfaced via `error`.
 */
import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { membersCol } from '../firebase/db'
import type { Member } from '../shared/types'

export interface UsePendingMembersResult {
  members: Member[]
  loading: boolean
  error: Error | null
}

export function usePendingMembers(): UsePendingMembersResult {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const q = query(membersCol, where('status', '==', 'pending'), orderBy('requestedAt', 'asc'))
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
  }, [])

  return { members, loading, error }
}

export default usePendingMembers
