/**
 * AuthProvider — single source of truth for authentication + membership.
 *
 * On every auth-state change:
 *   1. If signed in, upsert `users/{uid}` (displayName/email/photoURL/createdAt via
 *      serverTimestamp), using the typed db.ts converter. `isAdmin` is NEVER written
 *      by the client (firestore.rules also rejects any attempt).
 *   2. Read `users/{uid}.isAdmin` to compute `isAdmin`.
 *   3. Subscribe to `members/{uid}` via `onSnapshot` so `memberStatus` reflects an
 *      admin's approval/rejection live without a reload.
 *
 * Membership: `isMember = isAdmin || memberStatus === 'approved'`. The static
 * `config/allowlist` is gone (ticket 011) — it is no longer read here.
 *
 * Both listeners (auth + member doc) are cleaned up on unmount / sign-out.
 *
 * PENDING RUNTIME STEPS (console, not code):
 *   - Enable the Google sign-in provider in the Firebase console (`la-pollita-corp`).
 *   - Bootstrap the first admin once: set `users/{uid}.isAdmin = true` in the console.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { serverTimestamp, setDoc, getDoc, onSnapshot } from 'firebase/firestore'
import { onAuthChange, type FirebaseUser } from '../firebase/auth'
import { userDoc, memberDoc } from '../firebase/db'
import type { MemberStatus } from '../shared/types'
import { AuthContext, type AuthContextValue } from './authContext'

/**
 * Upsert the signed-in user's profile document. Uses `merge: true` so the out-of-band
 * `isAdmin` flag is preserved (we never send it). `createdAt` is stamped only on first
 * creation so it captures first-seen time and isn't rewritten on every sign-in.
 * Returns whether the existing doc had `isAdmin === true`.
 */
async function upsertUserProfile(user: FirebaseUser): Promise<boolean> {
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
  return existing.exists() && existing.data().isAdmin === true
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [memberStatus, setMemberStatus] = useState<MemberStatus | null>(null)
  const [loading, setLoading] = useState(true)
  // Guards against state updates after unmount / out-of-order async resolutions.
  const mountedRef = useRef(true)
  // Holds the active members/{uid} onSnapshot unsubscribe so we can tear it down
  // on sign-out / re-auth / unmount.
  const memberUnsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    mountedRef.current = true

    const stopMemberListener = () => {
      memberUnsubRef.current?.()
      memberUnsubRef.current = null
    }

    const unsubscribe = onAuthChange((nextUser) => {
      const run = async () => {
        setLoading(true)
        // Any previous member-doc subscription belongs to a prior user; drop it.
        stopMemberListener()

        if (!nextUser) {
          if (!mountedRef.current) return
          setUser(null)
          setIsAdmin(false)
          setMemberStatus(null)
          setLoading(false)
          return
        }

        let admin = false
        try {
          // Profile upsert must not block membership resolution if it fails (e.g.
          // transient offline); membership is what gates the app.
          admin = await upsertUserProfile(nextUser)
        } catch {
          // Swallowed: rules are the real gate; a failed upsert is non-fatal here.
        }

        if (!mountedRef.current) return
        setUser(nextUser)
        setIsAdmin(admin)

        // Subscribe to the user's own member doc so approval reflects live.
        memberUnsubRef.current = onSnapshot(
          memberDoc(nextUser.uid),
          (snap) => {
            if (!mountedRef.current) return
            setMemberStatus(snap.exists() ? (snap.data().status ?? null) : null)
            setLoading(false)
          },
          () => {
            if (!mountedRef.current) return
            // On a read error treat the user as having no request; rules gate access.
            setMemberStatus(null)
            setLoading(false)
          },
        )
      }
      void run()
    })

    return () => {
      mountedRef.current = false
      stopMemberListener()
      unsubscribe()
    }
  }, [])

  const isMember = isAdmin || memberStatus === 'approved'

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isMember, isAdmin, memberStatus }),
    [user, loading, isMember, isAdmin, memberStatus],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
