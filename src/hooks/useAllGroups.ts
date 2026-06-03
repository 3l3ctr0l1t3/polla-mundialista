/**
 * useAllGroups — every group across the tenant, for the superadmin god-view (ticket 014).
 *
 * A single live `onSnapshot` over `groupsCol` (a plain top-level collection read — no
 * filter, no composite index). Authorized only for a superadmin via the
 * `isSuperAdmin()` rule; a normal user's read is denied and surfaces as `error`.
 *
 * Read-only oversight: this hook never writes. Member counts/participants are loaded
 * lazily per group by the page (see `groupMembersCol`). Listener cleaned up on unmount.
 */
import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { groupsCol } from '../firebase/db'
import type { Group } from '../shared/types'

export interface UseAllGroupsResult {
  /** All groups, newest first. */
  groups: Group[]
  loading: boolean
  error: Error | null
}

export function useAllGroups(): UseAllGroupsResult {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      groupsCol,
      (snap) => {
        const rows = snap.docs.map((d) => d.data())
        // Newest first; createdAt may be a Firestore Timestamp (toMillis) on real data.
        rows.sort((a, b) => createdAtMillis(b) - createdAtMillis(a))
        setGroups(rows)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [])

  return { groups, loading, error }
}

/** Best-effort epoch millis for sorting; tolerant of missing/odd `createdAt`. */
function createdAtMillis(group: Group): number {
  const ts = group.createdAt as unknown as { toMillis?: () => number } | null | undefined
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis()
  return 0
}

export default useAllGroups
