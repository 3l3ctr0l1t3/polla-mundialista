import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PredictionInput } from './PredictionInput'
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

describe('PredictionInput', () => {
  it('allows editing the score before kickoff', () => {
    render(<PredictionInput gid="g1" match={makeMatch()} now={beforeKickoff} />)
    const home = screen.getByLabelText('HOM goals') as HTMLInputElement
    const away = screen.getByLabelText('AWY goals') as HTMLInputElement
    expect(home).not.toBeDisabled()
    expect(away).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /save prediction/i })).not.toBeDisabled()
  })

  it('disables inputs at/after kickoff', () => {
    render(<PredictionInput gid="g1" match={makeMatch()} now={afterKickoff} />)
    expect(screen.getByLabelText('HOM goals')).toBeDisabled()
    expect(screen.getByLabelText('AWY goals')).toBeDisabled()
    expect(screen.getByRole('button', { name: /save prediction/i })).toBeDisabled()
  })

  it('writes a new prediction with the right shape (createdAt + updatedAt, merge)', async () => {
    render(<PredictionInput gid="g1" match={makeMatch()} now={beforeKickoff} />)

    // Bump home to 2 and away to 1 via the increment buttons.
    fireEvent.click(screen.getByLabelText('Increase HOM goals'))
    fireEvent.click(screen.getByLabelText('Increase HOM goals'))
    fireEvent.click(screen.getByLabelText('Increase AWY goals'))

    fireEvent.click(screen.getByRole('button', { name: /save prediction/i }))

    await waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1))
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

  it('omits createdAt when editing an existing prediction and never writes points', async () => {
    const existing: Prediction = {
      uid: 'u1',
      matchId: 'm42',
      homeGoals: 1,
      awayGoals: 1,
      createdAt: { toMillis: () => 0 } as Prediction['createdAt'],
      updatedAt: { toMillis: () => 0 } as Prediction['updatedAt'],
    }
    render(<PredictionInput gid="g1" match={makeMatch()} existing={existing} now={beforeKickoff} />)

    fireEvent.click(screen.getByRole('button', { name: /update prediction/i }))

    await waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1))
    const payload = setDocMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload).not.toHaveProperty('createdAt')
    expect(payload).not.toHaveProperty('points')
    expect(payload).not.toHaveProperty('breakdown')
    expect(payload).toMatchObject({ uid: 'u1', matchId: 'm42', updatedAt: 'SERVER_TS' })
  })

  it('shows a "match already started" snackbar when the write is rejected by rules', async () => {
    setDocMock.mockRejectedValueOnce(
      Object.assign(new Error('denied'), { code: 'permission-denied' }),
    )

    render(<PredictionInput gid="g1" match={makeMatch()} now={beforeKickoff} />)
    fireEvent.click(screen.getByRole('button', { name: /save prediction/i }))

    expect(await screen.findByText(/already started/i)).toBeInTheDocument()
  })
})
