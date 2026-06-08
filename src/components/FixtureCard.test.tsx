import type { ReactNode } from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { Match, Prediction, PredictionMode } from '../shared/types'
import type { TournamentCutoffsMs } from '../shared/predictionLock'

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

// Group context: default lazy (mode absent). The card reads `group.mode` via `effectiveMode`.
const useGroupMock = vi.fn((): { group: { mode: PredictionMode | undefined } } => ({
  group: { mode: undefined },
}))
vi.mock('../group/useGroup', () => ({ useGroup: () => useGroupMock() }))

// Tournament cutoffs: default none (lazy fallback). Strict tests override.
const useTournamentConfigMock = vi.fn(
  (): { cutoffs: TournamentCutoffsMs | undefined; loading: boolean } => ({
    cutoffs: undefined,
    loading: false,
  }),
)
vi.mock('../hooks/useTournamentConfig', () => ({
  useTournamentConfig: () => useTournamentConfigMock(),
}))

// The reveal dialog is Firestore-backed and covered by its own tests; stub it to a
// recognizable marker that reflects its `open`/`kickedOff` props so this card test stays
// focused on the card.
const dialogMock = vi.fn<(p: { open: boolean; kickedOff: boolean }) => ReactNode>()
vi.mock('./MatchPredictionsDialog', () => ({
  MatchPredictionsDialog: (p: { open: boolean; kickedOff: boolean }) => dialogMock(p),
}))

// Imported after the mocks are registered.
import { FixtureCard } from './FixtureCard'

// --- fixtures --------------------------------------------------------------

const KICKOFF_MS = new Date('2026-06-11T20:00:00Z').getTime()
// Lazy lock fires 10 min before kickoff; straddle the lock instant, not raw kickoff.
const LOCK_MS = KICKOFF_MS - 10 * 60 * 1000
const beforeKickoff = () => LOCK_MS - 60_000 // window open
const afterKickoff = () => KICKOFF_MS + 60_000 // past kickoff (and the lock)

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    matchId: 'm42',
    kickoff: { toMillis: () => KICKOFF_MS, toDate: () => new Date(KICKOFF_MS) } as Match['kickoff'],
    status: 'TIMED',
    stage: 'GROUP_STAGE',
    group: 'A',
    homeTeam: { id: 1, name: 'Home', shortName: 'HOM', tla: 'HOM', crest: '' },
    awayTeam: { id: 2, name: 'Away', shortName: 'AWY', tla: 'AWY', crest: '' },
    score: { home: null, away: null, winner: null },
    lastUpdated: { toMillis: () => 0, toDate: () => new Date(0) } as Match['lastUpdated'],
    ...overrides,
  }
}

function existingPred(home: number, away: number): Prediction {
  return {
    uid: 'u1',
    matchId: 'm42',
    homeGoals: home,
    awayGoals: away,
    createdAt: { toMillis: () => 0 } as Prediction['createdAt'],
    updatedAt: { toMillis: () => 0 } as Prediction['updatedAt'],
  }
}

function renderCard(ui: ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

beforeEach(() => {
  setDocMock.mockClear()
  setDocMock.mockResolvedValue(undefined)
  groupPredictionDocMock.mockClear()
  dialogMock.mockReset()
  dialogMock.mockReturnValue(null)
  useGroupMock.mockReturnValue({ group: { mode: undefined } })
  useTournamentConfigMock.mockReturnValue({ cutoffs: undefined, loading: false })
})

describe('FixtureCard', () => {
  it('shows editable steppers + Save before kickoff (upcoming)', () => {
    renderCard(<FixtureCard gid="g1" match={makeMatch()} now={beforeKickoff} />)
    expect(screen.getByLabelText('HOM goals')).toHaveTextContent('0')
    expect(screen.getByLabelText('AWY goals')).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: /save prediction/i })).not.toBeDisabled()
    // No reveal button on an upcoming card.
    expect(screen.queryByRole('button', { name: /predictions/i })).toBeNull()
  })

  it('saves a new prediction with the right ref + shape on Save', async () => {
    renderCard(<FixtureCard gid="g1" match={makeMatch()} now={beforeKickoff} />)

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

  it('disables the steppers + Save at/after kickoff', () => {
    renderCard(<FixtureCard gid="g1" match={makeMatch()} now={afterKickoff} />)
    // The +/- controls and Save are disabled when locked.
    expect(screen.getByLabelText('Increase HOM goals')).toBeDisabled()
    expect(screen.getByLabelText('Increase AWY goals')).toBeDisabled()
    expect(screen.getByRole('button', { name: /save prediction/i })).toBeDisabled()
  })

  it('shows the score + the viewer own prediction (no steppers) when finished', () => {
    const match = makeMatch({
      status: 'FINISHED',
      score: { home: 2, away: 1, winner: 'HOME_TEAM' },
    })
    renderCard(
      <FixtureCard gid="g1" match={match} existing={existingPred(1, 0)} now={afterKickoff} />,
    )
    // Result score is shown.
    expect(screen.getByLabelText('Score 2 to 1')).toBeInTheDocument()
    // Viewer's own prediction is surfaced.
    expect(screen.getByText(/Your prediction 1–0/)).toBeInTheDocument()
    // No editable steppers on a finished card.
    expect(screen.queryByLabelText('Increase HOM goals')).toBeNull()
    expect(screen.queryByRole('button', { name: /save prediction/i })).toBeNull()
  })

  it('opens the reveal dialog (kicked off) from a finished card', () => {
    const match = makeMatch({ status: 'FINISHED', score: { home: 0, away: 0, winner: 'DRAW' } })
    renderCard(<FixtureCard gid="g1" match={match} now={afterKickoff} />)

    // Dialog rendered closed initially with kickedOff true (now > kickoff).
    expect(dialogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: false, kickedOff: true }),
    )
    fireEvent.click(screen.getByRole('button', { name: /predictions/i }))
    expect(dialogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: true, kickedOff: true }),
    )
  })

  it('passes kickedOff=false to the dialog for a not-yet-started in-play card', () => {
    // A live match that the viewer clock thinks hasn't kicked off yet: reveal stays gated.
    const match = makeMatch({ status: 'IN_PLAY', score: { home: 0, away: 0, winner: null } })
    renderCard(<FixtureCard gid="g1" match={match} now={beforeKickoff} />)
    expect(dialogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: false, kickedOff: false }),
    )
  })

  it('shows the strict group-window lock hint as a tooltip on the Locks-in chip', async () => {
    useGroupMock.mockReturnValue({ group: { mode: 'strict' } })
    useTournamentConfigMock.mockReturnValue({
      cutoffs: {
        firstCupMatchKickoffMs: KICKOFF_MS,
        firstKnockoutKickoffMs: KICKOFF_MS + 7 * 24 * 60 * 60 * 1000,
      },
      loading: false,
    })
    // A group-stage match whose own kickoff is far in the future; the lock is the group window.
    const match = makeMatch({ kickoff: makeMatch().kickoff, stage: 'GROUP_STAGE' })
    renderCard(<FixtureCard gid="g1" match={match} now={beforeKickoff} />)
    // The hint is no longer a standalone legend line — it rides on the countdown chip's tooltip.
    expect(screen.queryByText(/group-stage picks lock/i)).not.toBeInTheDocument()
    fireEvent.mouseOver(screen.getByText(/Locks in/i))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/group-stage picks lock/i)
  })
})
