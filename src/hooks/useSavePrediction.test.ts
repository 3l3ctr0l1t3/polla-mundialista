import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSavePrediction } from './useSavePrediction'
import type { Match, Prediction } from '../shared/types'

// --- mocks -----------------------------------------------------------------

const setDocMock = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve())

vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => 'SERVER_TS',
  setDoc: (...args: unknown[]) => setDocMock(...args),
}))

const groupPredictionDocMock = vi.fn((gid: string, uid: string, matchId: string) => ({
  __ref: `${gid}/${uid}_${matchId}`,
}))
vi.mock('../firebase/db', () => ({
  groupPredictionDoc: (gid: string, uid: string, matchId: string) =>
    groupPredictionDocMock(gid, uid, matchId),
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'a@b.com' }, loading: false }),
}))

// --- fixtures --------------------------------------------------------------

const KICKOFF_MS = new Date('2026-06-11T20:00:00Z').getTime()

function makeMatch(): Match {
  return {
    matchId: 'm42',
    kickoff: { toMillis: () => KICKOFF_MS } as Match['kickoff'],
    status: 'TIMED',
    stage: 'GROUP_STAGE',
    group: 'A',
    homeTeam: { id: 1, name: 'Home', shortName: 'HOM', tla: 'HOM', crest: '' },
    awayTeam: { id: 2, name: 'Away', shortName: 'AWY', tla: 'AWY', crest: '' },
    score: { home: null, away: null, winner: null },
    lastUpdated: { toMillis: () => 0 } as Match['lastUpdated'],
  }
}

const beforeKickoff = () => KICKOFF_MS - 60_000 // 1 min before
const afterKickoff = () => KICKOFF_MS + 60_000 // 1 min after

beforeEach(() => {
  setDocMock.mockClear()
  setDocMock.mockResolvedValue(undefined)
  groupPredictionDocMock.mockClear()
})

describe('useSavePrediction', () => {
  it('is unlocked before kickoff and locked at/after kickoff', () => {
    const open = renderHook(() => useSavePrediction('g1', makeMatch(), undefined, beforeKickoff))
    expect(open.result.current.locked).toBe(false)

    const closed = renderHook(() => useSavePrediction('g1', makeMatch(), undefined, afterKickoff))
    expect(closed.result.current.locked).toBe(true)
  })

  it('writes a new prediction with the right ref + shape (createdAt + updatedAt, merge)', async () => {
    const { result } = renderHook(() =>
      useSavePrediction('g1', makeMatch(), undefined, beforeKickoff),
    )

    act(() => {
      result.current.setHomeGoals(2)
      result.current.setAwayGoals(1)
    })
    await act(async () => {
      await result.current.save()
    })

    expect(setDocMock).toHaveBeenCalledTimes(1)
    const [ref, payload, options] = setDocMock.mock.calls[0]
    expect(groupPredictionDocMock).toHaveBeenCalledWith('g1', 'u1', 'm42')
    expect(ref).toEqual({ __ref: 'g1/u1_m42' })
    expect(payload).toEqual({
      uid: 'u1',
      matchId: 'm42',
      homeGoals: 2,
      awayGoals: 1,
      updatedAt: 'SERVER_TS',
      createdAt: 'SERVER_TS',
    })
    expect(options).toEqual({ merge: true })
  })

  it('omits createdAt when editing an existing prediction and never writes points/breakdown', async () => {
    const existing: Prediction = {
      uid: 'u1',
      matchId: 'm42',
      homeGoals: 1,
      awayGoals: 1,
      createdAt: { toMillis: () => 0 } as Prediction['createdAt'],
      updatedAt: { toMillis: () => 0 } as Prediction['updatedAt'],
    }
    const { result } = renderHook(() =>
      useSavePrediction('g1', makeMatch(), existing, beforeKickoff),
    )

    await act(async () => {
      await result.current.save()
    })

    expect(setDocMock).toHaveBeenCalledTimes(1)
    const payload = setDocMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload).not.toHaveProperty('createdAt')
    expect(payload).not.toHaveProperty('points')
    expect(payload).not.toHaveProperty('breakdown')
    expect(payload).toMatchObject({ uid: 'u1', matchId: 'm42', updatedAt: 'SERVER_TS' })
  })

  it('does not write when locked (at/after kickoff)', async () => {
    const { result } = renderHook(() =>
      useSavePrediction('g1', makeMatch(), undefined, afterKickoff),
    )
    await act(async () => {
      await result.current.save()
    })
    expect(setDocMock).not.toHaveBeenCalled()
  })

  it('surfaces a "match already started" snackbar when the write is rejected by rules', async () => {
    setDocMock.mockRejectedValueOnce(
      Object.assign(new Error('denied'), { code: 'permission-denied' }),
    )
    const { result } = renderHook(() =>
      useSavePrediction('g1', makeMatch(), undefined, beforeKickoff),
    )

    await act(async () => {
      await result.current.save()
    })

    await waitFor(() => expect(result.current.snack?.severity).toBe('error'))
    expect(result.current.snack?.message).toMatch(/already started/i)
  })

  it('dismissSnack clears the snackbar', async () => {
    const { result } = renderHook(() =>
      useSavePrediction('g1', makeMatch(), undefined, beforeKickoff),
    )
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.snack).not.toBeNull()
    act(() => result.current.dismissSnack())
    expect(result.current.snack).toBeNull()
  })
})
