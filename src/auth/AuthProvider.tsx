/**
 * AuthProvider — single source of truth for authentication (ticket 012).
 *
 * On every auth-state change:
 *   1. If signed in, upsert `users/{uid}` (displayName/email/photoURL/createdAt via
 *      serverTimestamp), using the typed db.ts converter. `isAdmin` is NEVER written
 *      by the client (firestore.rules also rejects any attempt).
 *
 * App access is OPEN to any signed-in user (ticket 012): there is no app-level
 * membership/admin gate anymore — membership is PER-GROUP (see `useGroup`/`useMyGroups`).
 * The auth listener is cleaned up on unmount / sign-out.
 *
 * PENDING RUNTIME STEPS (console, not code):
 *   - Enable the Google sign-in provider in the Firebase console (`la-pollita-corp`).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { serverTimestamp, setDoc, getDoc } from 'firebase/firestore'
import { onAuthChange, type FirebaseUser } from '../firebase/auth'
import { userDoc } from '../firebase/db'
import { AuthContext, type AuthContextValue } from './authContext'

/**
 * Upsert the signed-in user's profile document. Uses `merge: true` so the out-of-band
 * `isAdmin` flag is preserved (we never send it). `createdAt` is stamped only on first
 * creation so it captures first-seen time and isn't rewritten on every sign-in.
 */
async function upsertUserProfile(user: FirebaseUser): Promise<void> {
  const ref = userDoc(user.uid)
  const existing = await getDoc(ref)
  const profile = {
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    photoURL: user.photoURL ?? null,
    // serverTimestamp resolves on the server; only set on first creation.
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
  }
  await setDoc(ref, profile, { merge: true })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  // Guards against state updates after unmount / out-of-order async resolutions.
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const unsubscribe = onAuthChange((nextUser) => {
      const run = async () => {
        setLoading(true)

        if (!nextUser) {
          if (!mountedRef.current) return
          setUser(null)
          setLoading(false)
          return
        }

        try {
          // Profile upsert is best-effort; rules are the real gate.
          await upsertUserProfile(nextUser)
        } catch {
          // Swallowed: a failed upsert is non-fatal — the user is still signed in.
        }

        if (!mountedRef.current) return
        setUser(nextUser)
        setLoading(false)
      }
      void run()
    })

    return () => {
      mountedRef.current = false
      unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ user, loading }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
