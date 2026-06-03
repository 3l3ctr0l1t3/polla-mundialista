/**
 * Firebase Authentication helpers for Polla Mundialista.
 *
 * Wraps the Firebase Auth Web SDK around the shared `app` (config.ts). Sign-in is
 * Google-only; membership (allowlist) is enforced separately in AuthProvider and,
 * authoritatively, in `firestore.rules`.
 *
 * PENDING RUNTIME STEP: actual Google sign-in only works once the Google provider is
 * enabled in the Firebase console for project `la-pollita-corp`
 * (Authentication → Sign-in method → Google). Until then `signInWithGoogle()` will
 * reject with `auth/operation-not-allowed`. This is a console step, not a code change.
 */
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
  type Unsubscribe,
} from 'firebase/auth'
import { app } from './config'

export const auth: Auth = getAuth(app)

/** Google identity provider (always request the user's email scope). */
export const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('email')

/** Open the Google sign-in popup. Resolves with the signed-in Firebase user. */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  const credential = await signInWithPopup(auth, googleProvider)
  return credential.user
}

/** Sign the current user out. */
export function signOutUser(): Promise<void> {
  return signOut(auth)
}

/**
 * Subscribe to auth state changes. Returns the unsubscribe function — callers MUST
 * call it on unmount to avoid leaking the listener.
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback)
}

export type { FirebaseUser }
