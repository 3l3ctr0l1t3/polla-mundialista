import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Prediction } from '../shared/types'

// --- mocks -----------------------------------------------------------------

vi.mock('../firebase/db', () => ({
  groupPredictionsCol: (gid: string) => ({ __col: 'predictions', gid }),
}))

type SnapHandler = (snap: { docs: { data: () => Prediction }[] }) => void
let snapHandler: SnapHandler | null = null
const onSnapshotMock = vi.fn()
const whereMock = vi.fn(() => ({ __where: true }))

vi.mock('firebase/firestore', () => ({
  query: (col: unknown) => col,
  where: (...args: unknown[]) => whereMock(...(args as [])),
  onSnapshot: (ref: unknown, onNext: SnapHandler) => {
    onSnapshotMock(ref)
    snapHandler = onNext
    return () => {}
  },
}))

import { useMatchPredictions } from './useMatchPredictions'

const fakeTs = {} as Prediction['createdAt']

function pred(
  uid: string,
  homeGoals: number,
  awayGoals: number,
  points?: number,
): { data: () => Prediction } {
  return {
    data: () => ({
      uid,
      matchId: 'm1',
      homeGoals,
      awayGoals,
      createdAt: fakeTs,
      updatedAt: fakeTs,
      ...(points !== undefined ? { points } : {}),
    }),
  }
}

beforeEach(() => {
  snapHandler = null
  onSnapshotMock.mockClear()
  whereMock.mockClear()
})

describe('useMatchPredictions', () => {
  it('does NOT query others’ predictions for an upcoming match (not kicked off)', () => {
    const { result } = renderHook(() => useMatchPredictions('g1', 'm1', false))
    // No listener subscribed before kickoff — the rules would deny the read.
    expect(onSnapshotMock).not.toHaveBeenCalled()
    expect(result.current.predictions).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('queries everyone’s predictions once kicked off, sorted client-side', async () => {
    const { result } = renderHook(() => useMatchPredictions('g1', 'm1', true))

    expect(onSnapshotMock).toHaveBeenCalledTimes(1)
    // Equality-only filter on matchId (no orderBy -> no composite index).
    expect(whereMock).toHaveBeenCalledWith('matchId', '==', 'm1')

    act(() => {
      snapHandler!({ docs: [pred('a', 1, 0), pred('b', 3, 2, 5), pred('c', 2, 2)] })
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // Sorted by predicted home desc then away desc: b(3-2), c(2-2), a(1-0).
    expect(result.current.predictions.map((p) => p.uid)).toEqual(['b', 'c', 'a'])
    expect(result.current.predictions.find((p) => p.uid === 'b')?.points).toBe(5)
  })
})
