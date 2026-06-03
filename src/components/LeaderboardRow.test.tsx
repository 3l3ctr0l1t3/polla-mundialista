import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import List from '@mui/material/List'
import { LeaderboardRow } from './LeaderboardRow'
import { theme } from '../theme/theme'
import type { LeaderboardEntry } from '../shared/types'

// A minimal fake Timestamp is enough — the component never reads `updatedAt`.
const fakeTs = { seconds: 0, nanoseconds: 0 } as unknown as LeaderboardEntry['updatedAt']

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    uid: 'u1',
    displayName: 'Ada Lovelace',
    photoURL: null,
    totalPoints: 17,
    exactCount: 2,
    outcomeCount: 5,
    predictionsGraded: 9,
    rank: 1,
    updatedAt: fakeTs,
    ...overrides,
  }
}

function renderRow(ui: React.ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <List>{ui}</List>
    </ThemeProvider>,
  )
}

describe('LeaderboardRow', () => {
  it('renders rank, name, points and tiebreaker stats', () => {
    renderRow(<LeaderboardRow entry={makeEntry()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('Exact: 2')).toBeInTheDocument()
    expect(screen.getByText('Outcome: 5')).toBeInTheDocument()
  })

  it('shows a tied rank as "T-{rank}"', () => {
    renderRow(<LeaderboardRow entry={makeEntry({ rank: 3 })} isTie />)
    expect(screen.getByText('T-3')).toBeInTheDocument()
    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })

  it('marks the current user with aria-current and a "You" badge', () => {
    renderRow(<LeaderboardRow entry={makeEntry()} isCurrentUser />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveAttribute('aria-current', 'true')
  })

  it('does not mark other users as current', () => {
    renderRow(<LeaderboardRow entry={makeEntry()} />)
    expect(screen.queryByText('You')).not.toBeInTheDocument()
    expect(screen.getByRole('listitem')).not.toHaveAttribute('aria-current')
  })

  it('falls back to the name initial when no photo is provided', () => {
    renderRow(<LeaderboardRow entry={makeEntry({ photoURL: null })} />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })
})
