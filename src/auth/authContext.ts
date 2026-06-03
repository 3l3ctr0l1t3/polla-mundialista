import { createContext } from 'react'
import type { FirebaseUser } from '../firebase/auth'

/** Auth state shared across the app. */
export interface AuthContextValue {
  /** The signed-in Firebase user, or `null` when signed out. */
  user: FirebaseUser | null
  /** True until the initial auth + membership resolution completes. */
  loading: boolean
  /**
   * True when the signed-in user's email is present in `config/allowlist.emails`.
   * Always false when signed out, when the allowlist doc is missing, or when the
   * email is not listed. Membership is enforced authoritatively by `firestore.rules`.
   */
  isMember: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
