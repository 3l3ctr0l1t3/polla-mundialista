import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'

// The explainer reads the current group's effective scoring via useGroup.
const useGroupMock = vi.fn(() => ({ group: {} as { scoring?: unknown } }))
vi.mock('../group/useGroup', () => ({ useGroup: () => useGroupMock() }))

import { ScoringExplainer } from './ScoringExplainer'

function renderExplainer(open = true) {
  return render(
    <ThemeProvider theme={theme}>
      <ScoringExplainer open={open} onClose={() => {}} />
    </ThemeProvider>,
  )
}

describe('ScoringExplainer', () => {
  it('renders the base tiers, round bonuses and tie-break order for the default config', () => {
    renderExplainer()
    // Base tiers (defaults: exact 5, outcome 3, GD bonus +1; exact totals 6).
    expect(screen.getByText('Exact score: 5 pts')).toBeInTheDocument()
    expect(screen.getByText('Correct outcome: 3 pts')).toBeInTheDocument()
    expect(screen.getByText('Goal-difference bonus: +1 pts')).toBeInTheDocument()
    expect(screen.getByText(/totalling 6 pts/)).toBeInTheDocument()

    // Round bonus table: default escalation (Group 0 … Final +4, third place +3).
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
    renderExplainer()
    const finalRow = screen.getByText('Final').closest('tr')!
    expect(finalRow).toHaveTextContent('+10')
    // A non-overridden stage keeps its default.
    const sfRow = screen.getByText('Semi-finals').closest('tr')!
    expect(sfRow).toHaveTextContent('+3')
  })

  it('renders nothing visible when closed', () => {
    renderExplainer(false)
    expect(screen.queryByText('Exact score: 5 pts')).not.toBeInTheDocument()
  })
})
