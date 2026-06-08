import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import { sampleMatches, sampleMeta } from '../dev/sampleData'
import type { UseMatchesResult } from '../hooks/useMatches'
import type { UseMetaResult } from '../hooks/useMeta'

// Mock the live data hooks so the page renders deterministic sample data
// (no Firestore subscription in tests).
const useMatchesMock = vi.fn<() => UseMatchesResult>()
const useMetaMock = vi.fn<() => UseMetaResult>()

vi.mock('../hooks/useMatches', () => ({
  useMatches: () => useMatchesMock(),
}))
vi.mock('../hooks/useMeta', () => ({
  useMeta: () => useMetaMock(),
}))

// FixturesPage runs under a group route; stub the group context so the page can pass
// `gid` to each FixtureCard without a real <GroupProvider>.
vi.mock('../group/useGroup', () => ({
  useGroup: () => ({ gid: 'g1' }),
}))

// FixtureCard reads the viewer's per-group predictions, server time, and (via
// useSavePrediction) the signed-in user; stub them so this page test stays focused on the
// fixtures list. The real FixtureCard still renders teams/scores/TBD placeholders.
vi.mock('../hooks/useGroupPredictions', () => ({
  useGroupPredictions: () => ({ predictions: {}, loading: false, error: null }),
}))
vi.mock('../hooks/useServerTime', () => ({
  useServerTime: () => ({ now: () => Date.now(), offsetMs: 0, offsetKnown: true }),
}))
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'a@b.com' }, loading: false }),
}))
vi.mock('../components/MatchPredictionsDialog', () => ({
  MatchPredictionsDialog: () => null,
}))

// Imported after the mocks are registered.
import { FixturesPage } from './FixturesPage'

function renderPage(ui: ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

beforeEach(() => {
  useMatchesMock.mockReset()
  useMetaMock.mockReset()
  useMetaMock.mockReturnValue({ meta: sampleMeta, loading: false, error: null })
})

describe('FixturesPage', () => {
  it('shows the loading state while matches load', () => {
    useMatchesMock.mockReturnValue({ matches: [], loading: true, error: null })
    renderPage(<FixturesPage />)
    expect(screen.getByRole('status', { name: 'Loading fixtures' })).toBeInTheDocument()
  })

  it('shows the empty state when there are no matches (pre-seeding, live)', () => {
    useMatchesMock.mockReturnValue({ matches: [], loading: false, error: null })
    useMetaMock.mockReturnValue({ meta: null, loading: false, error: null })
    renderPage(<FixturesPage />)
    expect(screen.getByText('No fixtures yet')).toBeInTheDocument()
  })

  it('shows the error state when the listener fails', () => {
    useMatchesMock.mockReturnValue({
      matches: [],
      loading: false,
      error: new Error('permission-denied'),
    })
    renderPage(<FixturesPage />)
    expect(screen.getByText("Couldn't load fixtures")).toBeInTheDocument()
    expect(screen.getByText('permission-denied')).toBeInTheDocument()
  })

  it('renders one FixtureCard per match, grouped by day with the freshness badge', () => {
    useMatchesMock.mockReturnValue({ matches: sampleMatches, loading: false, error: null })
    renderPage(<FixturesPage />)

    // One unified FixtureCard per match (each card carries a "versus" aria-label).
    expect(screen.getAllByLabelText(/versus/i).length).toBe(sampleMatches.length)

    // Teams from the sample set render (Mexico appears in two sample fixtures).
    expect(screen.getAllByText('Mexico').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Brazil').length).toBeGreaterThanOrEqual(1)

    // TBD knockout still renders as placeholders, not a crash.
    expect(screen.getAllByText('TBD').length).toBeGreaterThanOrEqual(2)

    // Freshness badge from config/meta.lastIngestAt.
    expect(screen.getByText(/Updated/)).toBeInTheDocument()

    // Matches are grouped into day sections. The 4 sample fixtures span 3
    // distinct calendar days; allow 3 or 4 to stay timezone-robust (a kickoff
    // near midnight UTC can land on either side of a local day boundary).
    const sections = screen.getAllByRole('region')
    expect(sections.length).toBeGreaterThanOrEqual(3)
    expect(sections.length).toBeLessThanOrEqual(4)
  })
})
