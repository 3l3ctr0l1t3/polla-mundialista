import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { UseGroupRosterResult, RosterEntry } from '../hooks/useGroupRoster'

// --- mocks -----------------------------------------------------------------
// Mock the roster hook (its onSnapshot listeners need Firebase), plus the group + auth.

let rosterState: UseGroupRosterResult
vi.mock('../hooks/useGroupRoster', () => ({
  useGroupRoster: () => rosterState,
}))

vi.mock('../group/useGroup', () => ({
  useGroup: () => ({ gid: 'g1' }),
}))

let authUser: { uid: string } | null = null
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: authUser, loading: false }),
}))

import { LeaderboardPage } from './LeaderboardPage'

function makeEntry(overrides: Partial<RosterEntry>): RosterEntry {
  return {
    uid: 'u',
    displayName: 'Name',
    photoURL: null,
    totalPoints: 0,
    exactCount: 0,
    outcomeCount: 0,
    rank: 1,
    isTie: false,
    isOwner: false,
    joinedAtMs: 0,
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
  rosterState = { roster: [], loading: false, error: null }
})

describe('LeaderboardPage', () => {
  it('shows the loading state while fetching', () => {
    rosterState = { roster: [], loading: true, error: null }
    renderPage()
    expect(screen.getByRole('status', { name: 'Loading leaderboard' })).toBeInTheDocument()
  })

  it('shows the error state on listener failure', () => {
    rosterState = { roster: [], loading: false, error: new Error('denied') }
    renderPage()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Couldn’t load the leaderboard/)).toBeInTheDocument()
  })

  it('shows the empty state when the roster is somehow empty', () => {
    rosterState = { roster: [], loading: false, error: null }
    renderPage()
    expect(screen.getByText('No participants yet')).toBeInTheDocument()
  })

  it('no longer hosts the scoring rules (help button removed; rules live in the Rules tab)', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'How points work' })).not.toBeInTheDocument()
    expect(screen.queryByText('Exact score: 5 pts')).not.toBeInTheDocument()
  })

  it('notes that everyone is listed and points update after ingestion', () => {
    renderPage()
    expect(
      screen.getByText(
        'Everyone in the group is listed. Points update after each results ingestion run.',
      ),
    ).toBeInTheDocument()
  })

  it('lists every participant including 0-point members, in ranked order', () => {
    rosterState = {
      roster: [
        makeEntry({ uid: 'a', displayName: 'Alice', totalPoints: 20, rank: 1 }),
        makeEntry({ uid: 'b', displayName: 'Bob', totalPoints: 12, rank: 2 }),
        // Cara has no graded predictions yet but is still shown at 0.
        makeEntry({ uid: 'c', displayName: 'Cara', totalPoints: 0, rank: 3 }),
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
    rosterState = {
      roster: [
        makeEntry({ uid: 'a', displayName: 'Alice', totalPoints: 20, rank: 1 }),
        makeEntry({ uid: 'b', displayName: 'Bob', totalPoints: 12, rank: 2, isTie: true }),
        makeEntry({ uid: 'c', displayName: 'Cara', totalPoints: 12, rank: 2, isTie: true }),
      ],
      loading: false,
      error: null,
    }
    renderPage()
    expect(screen.getAllByText('T-2')).toHaveLength(2)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('highlights the signed-in user’s row', () => {
    authUser = { uid: 'b' }
    rosterState = {
      roster: [
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
