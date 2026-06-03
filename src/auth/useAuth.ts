import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './authContext'

/**
 * Access the auth context. Must be called inside an `<AuthProvider>` subtree.
 * Returns `{ user, loading, isMember }`.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
