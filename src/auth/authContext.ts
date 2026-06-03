import { createContext } from 'react'
import type { FirebaseUser } from '../firebase/auth'
import type { MemberStatus } from '../shared/types'

/** Auth + membership state shared across the app. */
export interface AuthContextValue {
  /** The signed-in Firebase user, or `null` when signed out. */
  user: FirebaseUser | null
  /** True until the initial auth + membership resolution completes. */
  loading: boolean
  /**
   * True when the signed-in user is an admin (`users/{uid}.isAdmin === true`)
   * or has an approved membership request. Always false when signed out.
   * Membership is enforced authoritatively by `firestore.rules`.
   */
  isMember: boolean
  /** True when `users/{uid}.isAdmin === true`. Always false when signed out. */
  isAdmin: boolean
  /**
   * The signed-in user's membership request status from `members/{uid}.status`,
   * or `null` when no request exists yet (or when signed out). Reflects approval
   * live via an `onSnapshot` listener.
   */
  memberStatus: MemberStatus | null
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
