import type { ReactNode } from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import { sampleScheduledMatch, sampleTbdMatch } from '../dev/sampleData'
import type { Match } from '../shared/types'

// --- mocks -----------------------------------------------------------------

// The page's local onSnapshot subscription: capture the success callback so each test
// can feed it deterministic sample matches (no Firestore in tests).
let onSnapshotNext: ((snap: { docs: { data: () => Match }[] }) => void) | null = null
let onSnapshotError: ((err: Error) => void) | null = null
vi.mock('firebase/firestore', async (importOriginal) => {
  // Keep the real module (sampleData uses `Timestamp`); only intercept the listener.
  const actual = await importOriginal<typeof import('firebase/firestore')>()
  return {
    ...actual,
    onSnapshot: (
      _q: unknown,
      next: (snap: { docs: { data: () => Match }[] }) => void,
      error: (err: Error) => void,
    ) => {
      onSnapshotNext = next
      onSnapshotError = error
      return () => {}
    },
    query: (...args: unknown[]) => args,
    orderBy: (...args: unknown[]) => args,
  }
})

vi.mock('../firebase/db', () => ({
  matchesCol: { __col: 'matches' },
}))

// The participant's saved predictions within the group.
let predictionsState: { predictions: Record<string, unknown>; error: Error | null }
vi.mock('../hooks/useGroupPredictions', () => ({
  useGroupPredictions: () => predictionsState,
}))

vi.mock('../group/useGroup', () => ({
  useGroup: () => ({ gid: 'g1' }),
}))

vi.mock('../hooks/useServerTime', () => ({
  useServerTime: () => ({ now: () => Date.now(), offsetMs: 0, offsetKnown: true }),
}))

// PredictionCard renders PredictionInput, which writes via auth + firebase; stub auth so
// the steppers render enabled and this page test stays focused on the layout.
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'a@b.com' }, loading: false }),
}))

import { PredictionsPage } from './PredictionsPage'

function feedMatches(matches: Match[]) {
  act(() => {
    onSnapshotNext?.({ docs: matches.map((m) => ({ data: () => m })) })
  })
}

function failListener(err: Error) {
  act(() => {
    onSnapshotError?.(err)
  })
}

function renderPage(ui: ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

beforeEach(() => {
  onSnapshotNext = null
  onSnapshotError = null
  predictionsState = { predictions: {}, error: null }
})

describe('PredictionsPage', () => {
  it('shows the loading state until matches arrive', () => {
    renderPage(<PredictionsPage />)
    expect(screen.getByRole('status', { name: 'Loading matches' })).toBeInTheDocument()
  })

  it('shows the empty state when there are no upcoming matches', () => {
    renderPage(<PredictionsPage />)
    feedMatches([])
    expect(screen.getByText('No upcoming matches')).toBeInTheDocument()
  })

  it('renders each upcoming match as a card with team names, crests and score steppers', () => {
    renderPage(<PredictionsPage />)
    feedMatches([sampleScheduledMatch])

    // Shared MatchTeams header: both team full names render (same as Fixtures).
    // (BRA's shortName is also "Brazil", so it appears in the stepper caption too.)
    expect(screen.getByText('United States')).toBeInTheDocument()
    expect(screen.getAllByText('Brazil').length).toBeGreaterThanOrEqual(1)

    // The team crests render via the shared MatchTeams header (Avatar carries the
    // crest URL), so flags appear here exactly as on the Fixtures page.
    expect(
      document.querySelector('img[src="https://crests.football-data.org/usa.svg"]'),
    ).not.toBeNull()
    expect(
      document.querySelector('img[src="https://crests.football-data.org/bra.svg"]'),
    ).not.toBeNull()

    // Prediction steppers are embedded in the card (labelled by team short name/TLA).
    expect(screen.getByLabelText('USA goals')).toBeInTheDocument()
    expect(screen.getByLabelText('Brazil goals')).toBeInTheDocument()

    // Grouped into a day section, matching the Fixtures layout.
    expect(screen.getAllByRole('region').length).toBeGreaterThanOrEqual(1)
  })

  it('renders TBD knockout placeholders without crashing', () => {
    renderPage(<PredictionsPage />)
    feedMatches([sampleTbdMatch])
    expect(screen.getAllByText('TBD').length).toBeGreaterThanOrEqual(2)
  })

  it('shows the error state when the matches listener fails', () => {
    renderPage(<PredictionsPage />)
    failListener(new Error('permission-denied'))
    expect(screen.getByText("Couldn't load predictions")).toBeInTheDocument()
  })
})
