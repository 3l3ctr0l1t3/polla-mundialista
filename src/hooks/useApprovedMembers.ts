/**
 * useApprovedMembers — live list of a group's approved members (ticket 015).
 *
 * Subscribes to `groups/{gid}/members` where `status == 'approved'` via `onSnapshot`,
 * sorted by `displayName` (case-insensitive). The listener is cleaned up on
 * unmount / gid change.
 *
 * The group OWNER has no member doc (their admin is derived from
 * `groups/{gid}.ownerUid`), so an approved-members query naturally excludes the
 * owner — which is exactly what the Admin "remove member" list wants.
 *
 * Only that group's admin can read other users' member docs (enforced by
 * `firestore.rules`); a non-admin subscription resolves to a permission error,
 * surfaced via `error`.
 *
 * Note: we filter on `status` only and sort by `displayName` in-memory. A
 * `where('status') + orderBy('displayName')` query would require a composite
 * index; the in-memory sort avoids adding one.
 */
import { useEffect, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { groupMembersCol } from '../firebase/db'
import type { Member } from '../shared/types'

export interface UseApprovedMembersResult {
  members: Member[]
  loading: boolean
  error: Error | null
}

export function useApprovedMembers(gid: string): UseApprovedMembersResult {
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
    const q = query(groupMembersCol(gid), where('status', '==', 'approved'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => d.data())
        next.sort((a, b) =>
          (a.displayName || '').localeCompare(b.displayName || '', undefined, {
            sensitivity: 'base',
          }),
        )
        setMembers(next)
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

export default useApprovedMembers
