import { createContext } from 'react'
import type { Group, MemberRole, MemberStatus } from '../shared/types'

/**
 * Per-group context (ticket 012). Subscribes to `groups/{gid}` plus the caller's own
 * `groups/{gid}/members/{uid}` doc, deriving the viewer's role/status within the group.
 *
 * The OWNER is implicit (no member doc): `isOwner` is derived from `group.ownerUid`,
 * and an owner is treated as an approved admin member.
 */
export interface GroupContextValue {
  /** The group id from the route. */
  gid: string
  /** The group doc, or `null` until loaded / if it does not exist. */
  group: Group | null
  /** The viewer's role within the group (owner ⇒ 'admin'); `null` if not a member. */
  role: MemberRole | null
  /** The viewer's membership status; owner ⇒ 'approved'; `null` if no request exists. */
  status: MemberStatus | null
  /** True when the viewer owns the group (`group.ownerUid === uid`). */
  isOwner: boolean
  /** True when the viewer may read the group's predictions/leaderboard (owner or approved). */
  isGroupMember: boolean
  /** True when the viewer may approve/reject members (owner or approved admin member). */
  isGroupAdmin: boolean
  /** True until both the group doc and the viewer's member doc have first resolved. */
  loading: boolean
  /** Set when a subscription errors (e.g. the group doc could not be read). */
  error: Error | null
}

export const GroupContext = createContext<GroupContextValue | undefined>(undefined)
