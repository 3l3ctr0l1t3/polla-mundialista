/**
 * GroupProvider — subscribes to the current group + the viewer's membership (ticket 012).
 *
 * Wraps the `/g/:gid/*` route subtree. It opens two `onSnapshot` listeners:
 *   - `groups/{gid}` (the group doc), and
 *   - `groups/{gid}/members/{uid}` (the viewer's OWN member doc — always readable by self).
 *
 * From these it derives the viewer's role/status. The owner is implicit (no member doc):
 * when `group.ownerUid === uid` the viewer is treated as an approved admin member.
 *
 * Both listeners are cleaned up on unmount and whenever `gid`/`uid` changes. Errors are
 * surfaced via `error`; the authoritative gate is always `firestore.rules`.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { groupDoc, groupMemberDoc } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import type { Group, MemberRole, MemberStatus } from '../shared/types'
import { GroupContext, type GroupContextValue } from './groupContext'

export function GroupProvider({ gid, children }: { gid: string; children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid ?? null

  const [group, setGroup] = useState<Group | null>(null)
  const [groupLoaded, setGroupLoaded] = useState(false)
  const [memberRole, setMemberRole] = useState<MemberRole | null>(null)
  const [memberStatus, setMemberStatus] = useState<MemberStatus | null>(null)
  const [memberLoaded, setMemberLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Subscribe to the group doc.
  useEffect(() => {
    setGroup(null)
    setGroupLoaded(false)
    setError(null)

    const unsubscribe = onSnapshot(
      groupDoc(gid),
      (snap) => {
        setGroup(snap.exists() ? snap.data() : null)
        setGroupLoaded(true)
      },
      (err) => {
        setError(err)
        setGroupLoaded(true)
      },
    )
    return unsubscribe
  }, [gid])

  // Subscribe to the viewer's own member doc (self is always readable).
  useEffect(() => {
    setMemberRole(null)
    setMemberStatus(null)

    if (!uid) {
      setMemberLoaded(true)
      return
    }
    setMemberLoaded(false)

    const unsubscribe = onSnapshot(
      groupMemberDoc(gid, uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          setMemberRole(data.role ?? 'member')
          setMemberStatus(data.status)
        } else {
          setMemberRole(null)
          setMemberStatus(null)
        }
        setMemberLoaded(true)
      },
      () => {
        // On a read error treat the viewer as having no membership; rules gate access.
        setMemberRole(null)
        setMemberStatus(null)
        setMemberLoaded(true)
      },
    )
    return unsubscribe
  }, [gid, uid])

  const value = useMemo<GroupContextValue>(() => {
    const isOwner = !!group && !!uid && group.ownerUid === uid
    const role: MemberRole | null = isOwner ? 'admin' : memberRole
    const status: MemberStatus | null = isOwner ? 'approved' : memberStatus
    const isApprovedMember = memberStatus === 'approved'
    const isGroupMember = isOwner || isApprovedMember
    const isGroupAdmin = isOwner || (isApprovedMember && memberRole === 'admin')

    return {
      gid,
      group,
      role,
      status,
      isOwner,
      isGroupMember,
      isGroupAdmin,
      loading: !groupLoaded || !memberLoaded,
      error,
    }
  }, [gid, group, uid, memberRole, memberStatus, groupLoaded, memberLoaded, error])

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

export default GroupProvider
