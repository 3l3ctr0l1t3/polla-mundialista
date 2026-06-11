import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useBoundaryTick, MAX_CHUNK_MS } from './useBoundaryTick'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

describe('useBoundaryTick', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const now = () => Date.now()

  it('fires exactly when the clock crosses a boundary, then arms no further timer', () => {
    const { result } = renderHook(() => useBoundaryTick(now, [1000]))
    expect(result.current).toBe(0)
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(999))
    expect(result.current).toBe(0) // not yet

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(1) // crossed — re-render forced
    expect(vi.getTimerCount()).toBe(0) // boundary past — nothing pending
  })

  it('chains ≤24h chunks for a far-away boundary (no 32-bit setTimeout overflow)', () => {
    // 30 days out — a raw setTimeout of this delay would overflow (2^31−1 ms ≈ 24.8 days).
    const boundary = 30 * DAY
    const { result } = renderHook(() => useBoundaryTick(now, [boundary]))
    expect(vi.getTimerCount()).toBe(1)

    // Each 24h chunk fires, bumps the tick, and re-arms — never a timer > MAX_CHUNK_MS.
    act(() => vi.advanceTimersByTime(MAX_CHUNK_MS))
    expect(result.current).toBe(1)
    expect(vi.getTimerCount()).toBe(1) // re-armed for the next chunk

    // March across the remaining 29 days one chunk at a time (each fire re-arms the next
    // chunk only after React flushes the effect — exactly how it chains in the browser).
    for (let day = 2; day <= 30; day++) {
      act(() => vi.advanceTimersByTime(DAY))
    }
    expect(Date.now()).toBe(boundary)
    expect(result.current).toBe(30) // 30 chunk fires total
    expect(vi.getTimerCount()).toBe(0) // past the boundary — quiescent
  })

  it('fires once per boundary, in order', () => {
    const ticksSeen: number[] = []
    const { result } = renderHook(() => {
      const tick = useBoundaryTick(now, [5000, 1000]) // unsorted on purpose
      ticksSeen.push(tick)
      return tick
    })

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(1) // first boundary (1000) despite array order
    expect(vi.getTimerCount()).toBe(1) // re-armed for 5000

    act(() => vi.advanceTimersByTime(4000))
    expect(result.current).toBe(2)
    expect(vi.getTimerCount()).toBe(0)
    expect(ticksSeen).toEqual([0, 1, 2]) // exactly one re-render per boundary
  })

  it('arms no timer when every boundary is already in the past', () => {
    vi.setSystemTime(10_000)
    const { result } = renderHook(() => useBoundaryTick(now, [1000, 5000]))
    expect(result.current).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the pending timer on unmount', () => {
    const { unmount } = renderHook(() => useBoundaryTick(now, [60_000]))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('re-arms against the new instants when boundaries change', () => {
    const { result, rerender } = renderHook(
      ({ boundaries }: { boundaries: number[] }) => useBoundaryTick(now, boundaries),
      { initialProps: { boundaries: [60_000] } },
    )
    expect(vi.getTimerCount()).toBe(1)

    rerender({ boundaries: [2000] })
    expect(vi.getTimerCount()).toBe(1) // old timer cleared, new one armed

    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBe(1)
    expect(vi.getTimerCount()).toBe(0) // the stale 60s timer is gone
  })
})
