import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './authContext'

/**
 * Access the auth context. Must be called inside an `<AuthProvider>` subtree.
 * Returns `{ user, loading, isSuperAdmin }`. Membership is per-group — see
 * `useGroup`/`useMyGroups`. `isSuperAdmin` mirrors `users/{uid}.isAdmin` (ticket 014)
 * and is an app-level, server-only flag (never client-writable).
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
