import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { PredictionMode } from '../shared/types'

// RulesPage (and the nested ScoringRules) read the group via useGroup.
let groupState: { group: { mode?: PredictionMode; scoring?: unknown } }
vi.mock('../group/useGroup', () => ({ useGroup: () => groupState }))

import { RulesPage } from './RulesPage'

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <RulesPage />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  groupState = { group: {} }
})

describe('RulesPage', () => {
  it('renders the scoring content from the shared component', () => {
    renderPage()
    expect(screen.getByText('How this group works')).toBeInTheDocument()
    // Scoring tiers + a round bonus + a tie-break item all render.
    expect(screen.getByText('Exact score: 5 pts')).toBeInTheDocument()
    expect(screen.getByText('Final').closest('tr')!).toHaveTextContent('+4')
    expect(screen.getByText('Most exact scores')).toBeInTheDocument()
  })

  it('shows the per-match lock copy for a lazy group', () => {
    groupState = { group: { mode: 'lazy' } }
    renderPage()
    expect(screen.getByText('Each match locks 10 minutes before its kickoff.')).toBeInTheDocument()
    // Strict batch-window copy is NOT shown for lazy.
    expect(
      screen.queryByText(/All group-stage picks lock 10 minutes before the first match/),
    ).not.toBeInTheDocument()
  })

  it('defaults to lazy when the group has no explicit mode', () => {
    groupState = { group: {} }
    renderPage()
    expect(screen.getByText('Each match locks 10 minutes before its kickoff.')).toBeInTheDocument()
  })

  it('shows both batch-window lock copies for a strict group', () => {
    groupState = { group: { mode: 'strict' } }
    renderPage()
    expect(
      screen.getByText(
        'All group-stage picks lock 10 minutes before the first match of the tournament.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('All knockout picks lock 10 minutes before the first knockout match.'),
    ).toBeInTheDocument()
    // The lazy copy is NOT shown for strict.
    expect(
      screen.queryByText('Each match locks 10 minutes before its kickoff.'),
    ).not.toBeInTheDocument()
  })
})
