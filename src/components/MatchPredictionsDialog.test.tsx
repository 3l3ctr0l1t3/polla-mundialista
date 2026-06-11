import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { Match, Prediction } from '../shared/types'
import type { RosterEntry, UseGroupRosterResult } from '../hooks/useGroupRoster'
import type { UseMatchPredictionsResult } from '../hooks/useMatchPredictions'
import { sampleScheduledMatch, sampleFinishedMatch } from '../dev/sampleData'

// --- mocks -----------------------------------------------------------------

let rosterState: UseGroupRosterResult
vi.mock('../hooks/useGroupRoster', () => ({
  useGroupRoster: () => rosterState,
}))

// Capture the `enabled` arg so we can assert the dialog never queries before kickoff.
const useMatchPredictionsMock =
  vi.fn<(gid: string, matchId: string, enabled: boolean) => UseMatchPredictionsResult>()
vi.mock('../hooks/useMatchPredictions', () => ({
  useMatchPredictions: (gid: string, matchId: string, enabled: boolean) =>
    useMatchPredictionsMock(gid, matchId, enabled),
}))

let authUser: { uid: string } | null = null
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: authUser, loading: false }),
}))

import { MatchPredictionsDialog } from './MatchPredictionsDialog'

const fakeTs = {} as Prediction['createdAt']

function rosterEntry(uid: string, displayName: string): RosterEntry {
  return {
    uid,
    displayName,
    photoURL: null,
    totalPoints: 0,
    exactCount: 0,
    outcomeCount: 0,
    rank: 1,
    isTie: false,
    isOwner: false,
    joinedAtMs: 0,
  }
}

function pred(uid: string, homeGoals: number, awayGoals: number, points?: number): Prediction {
  return {
    uid,
    matchId: sampleFinishedMatch.matchId,
    homeGoals,
    awayGoals,
    createdAt: fakeTs,
    updatedAt: fakeTs,
    ...(points !== undefined ? { points } : {}),
  }
}

function renderDialog(match: Match, kickedOff: boolean) {
  return render(
    <ThemeProvider theme={theme}>
      <MatchPredictionsDialog
        gid="g1"
        match={match}
        kickedOff={kickedOff}
        open
        onClose={() => {}}
      />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  authUser = null
  rosterState = { roster: [], loading: false, error: null }
  useMatchPredictionsMock.mockReset()
  useMatchPredictionsMock.mockReturnValue({ predictions: [], loading: false, error: null })
})

describe('MatchPredictionsDialog', () => {
  it('shows the reveal placeholder for an upcoming match and does NOT enable the query', () => {
    renderDialog(sampleScheduledMatch, false)
    expect(screen.getByText('Predictions reveal at kickoff')).toBeInTheDocument()
    // The reveal hook is mounted but explicitly disabled (no query before kickoff).
    expect(useMatchPredictionsMock).toHaveBeenLastCalledWith(
      'g1',
      sampleScheduledMatch.matchId,
      false,
    )
  })

  it('reveals every member’s scoreline once kicked off, mapping uid -> name', () => {
    authUser = { uid: 'b' }
    rosterState = {
      roster: [rosterEntry('a', 'Alice'), rosterEntry('b', 'Bob')],
      loading: false,
      error: null,
    }
    useMatchPredictionsMock.mockReturnValue({
      predictions: [pred('a', 2, 1), pred('b', 0, 0)],
      loading: false,
      error: null,
    })

    renderDialog(sampleFinishedMatch, true)

    // Query enabled for a kicked-off match.
    expect(useMatchPredictionsMock).toHaveBeenLastCalledWith(
      'g1',
      sampleFinishedMatch.matchId,
      true,
    )

    // Names resolved from the roster + the scorelines shown.
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByLabelText('Predicted 2 to 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Predicted 0 to 0')).toBeInTheDocument()
    // Current user highlighted.
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('hides predictions left behind by removed (non-roster) members', () => {
    rosterState = { roster: [rosterEntry('a', 'Alice')], loading: false, error: null }
    useMatchPredictionsMock.mockReturnValue({
      // 'ghost' saved a prediction while a member, then was removed from the group.
      predictions: [pred('a', 2, 1), pred('ghost', 3, 0)],
      loading: false,
      error: null,
    })
    renderDialog(sampleFinishedMatch, true)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Unknown member')).toBeNull()
    expect(screen.queryByLabelText('Predicted 3 to 0')).toBeNull()
  })

  it('keeps the loading state until the roster has loaded (no unknown-member flash)', () => {
    rosterState = { roster: [], loading: true, error: null }
    useMatchPredictionsMock.mockReturnValue({
      predictions: [pred('a', 2, 1)],
      loading: false,
      error: null,
    })
    renderDialog(sampleFinishedMatch, true)
    expect(screen.getByLabelText('Loading predictions')).toBeInTheDocument()
    expect(screen.queryByText('Unknown member')).toBeNull()
  })

  it('shows earned points for a FINISHED match', () => {
    rosterState = { roster: [rosterEntry('a', 'Alice')], loading: false, error: null }
    useMatchPredictionsMock.mockReturnValue({
      predictions: [pred('a', 2, 1, 5)],
      loading: false,
      error: null,
    })
    renderDialog(sampleFinishedMatch, true)
    expect(screen.getByLabelText('Earned 5 points')).toBeInTheDocument()
  })
})
