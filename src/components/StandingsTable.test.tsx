/**
 * StandingsTable localization tests (ticket 020, AC1 & AC4).
 *
 * The standings table must render Spanish country names under `es`, the original English
 * names under `en`, and the SHARED localized TBD placeholder (no hardcoded 'TBD') for an
 * undecided row.
 */
import type { ReactNode } from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import i18n from '../i18n'
import { theme } from '../theme/theme'
import { StandingsTable } from './StandingsTable'
import { sampleStanding } from '../dev/sampleData'
import type { Standing, Team } from '../shared/types'

function renderTable(ui: ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

const TBD_TEAM: Team = { id: -1, name: '', shortName: '', tla: '', crest: '' }
const standingWithTbd: Standing = {
  ...sampleStanding,
  table: [{ ...sampleStanding.table[0], team: TBD_TEAM }],
}

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en')
  })
})

describe('StandingsTable localization', () => {
  it('renders English country names under en (AC2)', async () => {
    await i18n.changeLanguage('en')
    renderTable(<StandingsTable standing={sampleStanding} />)
    expect(screen.getByText('Mexico')).toBeInTheDocument()
    expect(screen.getByText('Canada')).toBeInTheDocument()
  })

  it('renders Spanish country names under es (AC1)', async () => {
    await i18n.changeLanguage('es')
    renderTable(<StandingsTable standing={sampleStanding} />)
    expect(screen.getByText('México')).toBeInTheDocument()
    expect(screen.getByText('Canadá')).toBeInTheDocument()
  })

  it('uses the shared localized TBD placeholder for an undecided row (AC4)', async () => {
    await i18n.changeLanguage('es')
    renderTable(<StandingsTable standing={standingWithTbd} />)
    expect(screen.getByText('Por definir')).toBeInTheDocument()
    expect(screen.queryByText('TBD')).not.toBeInTheDocument()
  })
})
