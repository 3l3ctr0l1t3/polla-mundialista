/**
 * useServerTime — a clock-skew-resistant time source for the kickoff lock UI.
 *
 * The kickoff lock is authoritatively enforced server-side in `firestore.rules`
 * (`request.time < match.kickoff`); a participant with a wrong device clock must not be
 * able to *visually* unlock an input that the rule will reject. To make the UI honest we
 * establish a one-time offset between this device's clock and Firestore's server clock.
 *
 * Approach: on mount, write `serverTimestamp()` to the signed-in user's own throwaway doc
 * `serverTime/{uid}` and read the resolved timestamp back. The difference between the
 * resolved server time and the local time at read marks the offset. `now()` then returns
 * `Date.now() + offsetMs`, i.e. server-corrected wall-clock millis.
 *
 * If the round-trip can't complete (offline, rules, signed-out) we fall back to
 * `Date.now()` with `offsetKnown === false`. That is safe: the UI lock is convenience
 * only — the Firestore rule is the real gate (constitution §4).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp, type Timestamp } from 'firebase/firestore'
import { db } from '../firebase/db'
import { useAuth } from '../auth/useAuth'

export interface ServerTime {
  /** Server-corrected wall-clock time in milliseconds since the Unix epoch. */
  now: () => number
  /** Measured offset added to `Date.now()` (server − client), in ms. `0` until known. */
  offsetMs: number
  /** True once the offset has been measured against the server; false while falling back. */
  offsetKnown: boolean
}

export function useServerTime(): ServerTime {
  const { user } = useAuth()
  // Use a ref so `now()` is a stable closure that always reads the latest offset.
  const offsetRef = useRef(0)
  const [offsetMs, setOffsetMs] = useState(0)
  const [offsetKnown, setOffsetKnown] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function measure(uid: string) {
      try {
        const ref = doc(db, 'serverTime', uid)
        await setDoc(ref, { at: serverTimestamp() })
        const snap = await getDoc(ref)
        const serverTs = snap.get('at') as Timestamp | null | undefined
        if (cancelled || !serverTs) return
        const serverMs = serverTs.toMillis()
        const next = serverMs - Date.now()
        offsetRef.current = next
        setOffsetMs(next)
        setOffsetKnown(true)
      } catch {
        // Round-trip not feasible — keep the Date.now() fallback. The rule still gates writes.
        if (!cancelled) {
          offsetRef.current = 0
          setOffsetMs(0)
          setOffsetKnown(false)
        }
      }
    }

    void measure(user.uid)
    return () => {
      cancelled = true
    }
  }, [user])

  // `now` reads the ref at call time, so a single stable function reflects the latest offset.
  const now = useCallback(() => Date.now() + offsetRef.current, [])
  return { now, offsetMs, offsetKnown }
}

export default useServerTime
