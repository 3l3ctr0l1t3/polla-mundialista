import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { MatchCard } from './MatchCard'
import { theme } from '../theme/theme'
import {
  sampleFinishedMatch,
  sampleScheduledMatch,
  sampleTbdMatch,
  sampleLiveMatch,
} from '../dev/sampleData'

function renderCard(ui: ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

describe('MatchCard', () => {
  it('renders a scheduled match without a score and with a Scheduled chip', () => {
    renderCard(<MatchCard match={sampleScheduledMatch} />)
    expect(screen.getByText('United States')).toBeInTheDocument()
    expect(screen.getByText('Brazil')).toBeInTheDocument()
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
    // No "–" score separator for an unplayed match.
    expect(screen.queryByLabelText(/^Score /)).not.toBeInTheDocument()
  })

  it('renders a finished match with its score and a Finished chip', () => {
    renderCard(<MatchCard match={sampleFinishedMatch} />)
    expect(screen.getByText('Mexico')).toBeInTheDocument()
    expect(screen.getByText('Canada')).toBeInTheDocument()
    expect(screen.getByText('Finished')).toBeInTheDocument()
    expect(screen.getByLabelText('Score 2 to 1')).toBeInTheDocument()
  })

  it('renders an in-play match as Live with the running score', () => {
    renderCard(<MatchCard match={sampleLiveMatch} />)
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByLabelText('Score 1 to 0')).toBeInTheDocument()
  })

  it('renders TBD placeholders for an undecided knockout match without crashing', () => {
    renderCard(<MatchCard match={sampleTbdMatch} />)
    const tbd = screen.getAllByText('TBD')
    expect(tbd).toHaveLength(2)
    // Knockout fixture has no group letter -> shows the stage label.
    expect(screen.getByText(/Round of 32/)).toBeInTheDocument()
  })
})
