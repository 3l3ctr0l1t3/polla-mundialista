import { createContext } from 'react'
import type { FirebaseUser } from '../firebase/auth'

/** Auth state shared across the app. Membership is now PER-GROUP (ticket 012). */
export interface AuthContextValue {
  /** The signed-in Firebase user, or `null` when signed out. */
  user: FirebaseUser | null
  /** True until the initial auth resolution completes. */
  loading: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
