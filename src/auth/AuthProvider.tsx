/**
 * AuthProvider — single source of truth for authentication + membership.
 *
 * On every auth-state change:
 *   1. If signed in, upsert `users/{uid}` (displayName/email/photoURL/createdAt via
 *      serverTimestamp), using the typed db.ts converter. `isAdmin` is NEVER written
 *      by the client (firestore.rules also rejects any attempt).
 *   2. Compute `isMember` by reading `config/allowlist.emails`. A missing doc or an
 *      email not in the list is treated as NOT a member.
 *
 * The auth listener is cleaned up on unmount.
 *
 * PENDING RUNTIME STEPS (console, not code):
 *   - Enable the Google sign-in provider in the Firebase console (`la-pollita-corp`).
 *   - Seed `config/allowlist` with `{ emails: [...] }` so members pass the gate.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { serverTimestamp, setDoc, getDoc } from 'firebase/firestore'
import { onAuthChange, type FirebaseUser } from '../firebase/auth'
import { userDoc, allowlistConfigDoc } from '../firebase/db'
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

/** Read `config/allowlist.emails`; return true iff `email` is listed. */
async function resolveMembership(email: string | null): Promise<boolean> {
  if (!email) return false
  const snap = await getDoc(allowlistConfigDoc())
  if (!snap.exists()) return false
  const emails = snap.data().emails ?? []
  return emails.includes(email)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(true)
  // Guards against state updates after unmount / out-of-order async resolutions.
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const unsubscribe = onAuthChange((nextUser) => {
      // Each callback owns a token so a stale resolution can't overwrite newer state.
      const run = async () => {
        setLoading(true)
        if (!nextUser) {
          if (!mountedRef.current) return
          setUser(null)
          setIsMember(false)
          setLoading(false)
          return
        }

        try {
          // Profile upsert must not block membership resolution if it fails (e.g.
          // transient offline); membership is what gates the app.
          await upsertUserProfile(nextUser)
        } catch {
          // Swallowed: rules are the real gate; a failed upsert is non-fatal here.
        }
        let member: boolean
        try {
          member = await resolveMembership(nextUser.email)
        } catch {
          member = false
        }

        if (!mountedRef.current) return
        setUser(nextUser)
        setIsMember(member)
        setLoading(false)
      }
      void run()
    })

    return () => {
      mountedRef.current = false
      unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isMember }),
    [user, loading, isMember],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
