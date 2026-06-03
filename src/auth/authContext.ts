import { createContext } from 'react'
import type { FirebaseUser } from '../firebase/auth'

/** Auth state shared across the app. Membership is now PER-GROUP (ticket 012). */
export interface AuthContextValue {
  /** The signed-in Firebase user, or `null` when signed out. */
  user: FirebaseUser | null
  /** True until the initial auth resolution completes. */
  loading: boolean
  /**
   * App-level superadmin flag, mirrored live from `users/{uid}.isAdmin` (ticket 014).
   * Set ONLY out-of-band via the admin SDK; the client never writes it. Defaults to
   * `false` (signed out, or while the user doc has not yet been read).
   */
  isSuperAdmin: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
