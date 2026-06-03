import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { LeaderboardEntry } from '../shared/types'
import type { UseLeaderboardResult } from '../hooks/useLeaderboard'

// --- mocks -----------------------------------------------------------------
// Mock the hook (its onSnapshot listener needs Firebase) and auth context.

let leaderboardState: UseLeaderboardResult
vi.mock('../hooks/useLeaderboard', () => ({
  useLeaderboard: () => leaderboardState,
}))

let authUser: { uid: string } | null = null
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: authUser, loading: false, isMember: true }),
}))

import { LeaderboardPage } from './LeaderboardPage'

const fakeTs = { seconds: 0, nanoseconds: 0 } as unknown as LeaderboardEntry['updatedAt']

function makeEntry(overrides: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    uid: 'u',
    displayName: 'Name',
    photoURL: null,
    totalPoints: 0,
    exactCount: 0,
    outcomeCount: 0,
    predictionsGraded: 0,
    rank: 1,
    updatedAt: fakeTs,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <LeaderboardPage />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  authUser = null
  leaderboardState = { entries: [], loading: false, error: null }
})

describe('LeaderboardPage', () => {
  it('shows the loading state while fetching', () => {
    leaderboardState = { entries: [], loading: true, error: null }
    renderPage()
    expect(screen.getByRole('status', { name: 'Loading leaderboard' })).toBeInTheDocument()
  })

  it('shows the error state on listener failure', () => {
    leaderboardState = { entries: [], loading: false, error: new Error('denied') }
    renderPage()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Couldn’t load the leaderboard/)).toBeInTheDocument()
  })

  it('shows the empty state when there are no aggregates yet', () => {
    leaderboardState = { entries: [], loading: false, error: null }
    renderPage()
    expect(screen.getByText('No standings yet')).toBeInTheDocument()
  })

  it('always notes that rankings update after ingestion', () => {
    renderPage()
    expect(
      screen.getByText('Rankings update after each results ingestion run.'),
    ).toBeInTheDocument()
  })

  it('renders entries in the order supplied by the hook (totalPoints desc)', () => {
    leaderboardState = {
      entries: [
        makeEntry({ uid: 'a', displayName: 'Alice', totalPoints: 20, rank: 1 }),
        makeEntry({ uid: 'b', displayName: 'Bob', totalPoints: 12, rank: 2 }),
        makeEntry({ uid: 'c', displayName: 'Cara', totalPoints: 5, rank: 3 }),
      ],
      loading: false,
      error: null,
    }
    renderPage()
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('Alice')).toBeInTheDocument()
    expect(within(items[1]).getByText('Bob')).toBeInTheDocument()
    expect(within(items[2]).getByText('Cara')).toBeInTheDocument()
  })

  it('shows tied ranks as "T-{rank}" and unique ranks plainly', () => {
    leaderboardState = {
      entries: [
        makeEntry({ uid: 'a', displayName: 'Alice', totalPoints: 20, rank: 1 }),
        // Bob & Cara are tied on points and exact/outcome counts -> shared rank 2.
        makeEntry({ uid: 'b', displayName: 'Bob', totalPoints: 12, rank: 2 }),
        makeEntry({ uid: 'c', displayName: 'Cara', totalPoints: 12, rank: 2 }),
      ],
      loading: false,
      error: null,
    }
    renderPage()
    // Two tied entries both render "T-2".
    expect(screen.getAllByText('T-2')).toHaveLength(2)
    // The unique leader renders a plain "1".
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('highlights the signed-in user’s row', () => {
    authUser = { uid: 'b' }
    leaderboardState = {
      entries: [
        makeEntry({ uid: 'a', displayName: 'Alice', totalPoints: 20, rank: 1 }),
        makeEntry({ uid: 'b', displayName: 'Bob', totalPoints: 12, rank: 2 }),
      ],
      loading: false,
      error: null,
    }
    renderPage()
    expect(screen.getByText('You')).toBeInTheDocument()
    const current = screen.getByText('Bob').closest('li')
    expect(current).toHaveAttribute('aria-current', 'true')
  })
})
