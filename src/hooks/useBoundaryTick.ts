/**
 * useBoundaryTick — forces a re-render of the calling component each time the
 * server-corrected clock crosses one of the given instants (ms epoch).
 *
 * Why: values like `locked` / `kickedOff` are derived from `now()` at render time, so
 * without a nudge the component would keep showing the pre-boundary UI until something
 * else re-rendered it (ticket 027, spec rule 9). This hook arms ONE `setTimeout` for the
 * next future boundary — chained in ≤ 24 h chunks so a strict-mode boundary weeks away
 * never overflows `setTimeout`'s signed 32-bit ms limit (~24.8 days) — and bumps a state
 * counter when it fires, which re-runs the effect and re-arms for the next chunk/boundary.
 *
 * Cost: at most one cheap pending timer per caller, firing a handful of times across the
 * component's life. No timer at all once every boundary is in the past. The timer is
 * cleared on unmount and whenever `boundaries` change.
 *
 * Returns the tick count — callers normally ignore it (the re-render is the point).
 */
import { useEffect, useRef, useState } from 'react'

/** Max single `setTimeout` delay — 24 h chunks stay far below the 2^31−1 ms overflow. */
export const MAX_CHUNK_MS = 24 * 60 * 60 * 1000

export function useBoundaryTick(now: () => number, boundaries: readonly number[]): number {
  const [tick, setTick] = useState(0)

  // Refs so a caller passing a fresh closure/array each render doesn't re-arm the timer
  // every render; the timer effect re-runs only when the boundary VALUES change (or on a
  // fire). Synced in an effect (not during render — react-hooks/refs) that is declared
  // FIRST, so it runs before the timer effect on every commit.
  const nowRef = useRef(now)
  const boundariesRef = useRef(boundaries)
  useEffect(() => {
    nowRef.current = now
    boundariesRef.current = boundaries
  })
  const boundariesKey = boundaries.join(',')

  useEffect(() => {
    // `tick` and `boundariesKey` are deliberate triggers: a fire re-arms the next
    // chunk/boundary, and changed boundary VALUES re-arm from scratch.
    void tick
    void boundariesKey

    const current = nowRef.current()
    // Next boundary still in the future (boundaries need not be sorted).
    let next = Infinity
    for (const b of boundariesRef.current) {
      if (b > current && b < next) next = b
    }
    if (!Number.isFinite(next)) return undefined // all past — no timer

    const id = setTimeout(
      () => setTick((n) => n + 1), // re-render; effect re-runs and re-arms
      Math.min(next - current, MAX_CHUNK_MS),
    )
    return () => clearTimeout(id)
  }, [boundariesKey, tick])

  return tick
}

export default useBoundaryTick
