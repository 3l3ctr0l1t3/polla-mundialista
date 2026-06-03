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

  it('renders matches grouped by day with the freshness badge', () => {
    useMatchesMock.mockReturnValue({ matches: sampleMatches, loading: false, error: null })
    renderPage(<FixturesPage />)

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
