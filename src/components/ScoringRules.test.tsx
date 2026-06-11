import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'

// ScoringRules reads the current group's effective scoring via useGroup.
const useGroupMock = vi.fn(() => ({ group: {} as { scoring?: unknown } }))
vi.mock('../group/useGroup', () => ({ useGroup: () => useGroupMock() }))

import { ScoringRules } from './ScoringRules'

function renderRules() {
  return render(
    <ThemeProvider theme={theme}>
      <ScoringRules />
    </ThemeProvider>,
  )
}

describe('ScoringRules', () => {
  it('renders the base tiers, round bonuses and tie-break order for the default config', () => {
    renderRules()
    // Base tiers (defaults: exact 5, outcome 3, GD bonus +1; exact totals 6).
    expect(screen.getByText('Exact score: 5 pts')).toBeInTheDocument()
    expect(screen.getByText('Correct outcome: 3 pts')).toBeInTheDocument()
    expect(screen.getByText('Goal-difference bonus: +1 pts')).toBeInTheDocument()
    expect(screen.getByText(/totalling 6 pts/)).toBeInTheDocument()

    // Round bonus table: default escalation (Final +4, Round of 16 +1).
    const finalRow = screen.getByText('Final').closest('tr')!
    expect(finalRow).toHaveTextContent('+4')
    const r16Row = screen.getByText('Round of 16').closest('tr')!
    expect(r16Row).toHaveTextContent('+1')

    // Tie-break order is disclosed.
    expect(screen.getByText('Most exact scores')).toBeInTheDocument()
    expect(screen.getByText('Joined the group first')).toBeInTheDocument()
  })

  it('reflects a group override (Final bonus 10) merged over the defaults', () => {
    useGroupMock.mockReturnValueOnce({ group: { scoring: { roundBonus: { FINAL: 10 } } } })
    renderRules()
    const finalRow = screen.getByText('Final').closest('tr')!
    expect(finalRow).toHaveTextContent('+10')
    // A non-overridden stage keeps its default.
    const sfRow = screen.getByText('Semi-finals').closest('tr')!
    expect(sfRow).toHaveTextContent('+3')
  })
})
