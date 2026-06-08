/**
 * Locale-aware team-name resolution tests (ticket 020).
 *
 * Covers the acceptance rules for the ONE localization rule (`localizeTeamName` /
 * `useTeamName`): Spanish under `es`, original English under `en`, the live language
 * switch (no reload), the localized TBD placeholder, the missing-entry fallback, and
 * seed-data coverage.
 */
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import i18n from './index'
import { theme } from '../theme/theme'
import { localizeTeamName, useTeamName } from './useTeamName'
import { countryNamesEs } from './countryNamesEs'
import { MatchTeams } from '../components/MatchTeams'
import type { Team } from '../shared/types'
import { sampleMatches, sampleStandings } from '../dev/sampleData'
import { isTbdTeam } from '../hooks/matchGrouping'

const BRA: Team = { id: 764, name: 'Brazil', shortName: 'Brazil', tla: 'BRA', crest: '' }
const TBD: Team = { id: -1, name: '', shortName: '', tla: '', crest: '' }
/** A real team whose `tla` is intentionally absent from the Spanish map. */
const UNKNOWN: Team = { id: 999, name: 'Atlantis', shortName: 'Atlantis', tla: 'ZZZ', crest: '' }

afterEach(async () => {
  // Restore the pinned default so other tests render English (see src/test/setup.ts).
  await act(async () => {
    await i18n.changeLanguage('en')
  })
})

describe('localizeTeamName (pure resolver)', () => {
  const TBD_LABEL = 'TBD'

  it('returns the Spanish name when language is es and an entry exists (AC1)', () => {
    expect(localizeTeamName(BRA, 'es', TBD_LABEL)).toBe('Brasil')
  })

  it('returns the original English name when language is en (AC2)', () => {
    expect(localizeTeamName(BRA, 'en', TBD_LABEL)).toBe('Brazil')
  })

  it('treats region-qualified Spanish tags (es-CO) as Spanish', () => {
    expect(localizeTeamName(BRA, 'es-CO', TBD_LABEL)).toBe('Brasil')
  })

  it('returns the localized placeholder for an undecided team (AC4)', () => {
    expect(localizeTeamName(TBD, 'es', 'Por definir')).toBe('Por definir')
    expect(localizeTeamName(TBD, 'en', 'TBD')).toBe('TBD')
  })

  it('falls back to the original name when no Spanish entry exists (AC5)', () => {
    expect(localizeTeamName(UNKNOWN, 'es', TBD_LABEL)).toBe('Atlantis')
  })
})

/** Tiny harness rendering both teams' resolved names via the hook. */
function TwoTeams({ home, away }: { home: Team; away: Team }) {
  const teamName = useTeamName()
  return (
    <ThemeProvider theme={theme}>
      <span data-testid="home">{teamName(home)}</span>
      <span data-testid="away">{teamName(away)}</span>
    </ThemeProvider>
  )
}

describe('useTeamName (hook)', () => {
  it('renders English then Spanish across a live language switch — no reload (AC3)', async () => {
    await i18n.changeLanguage('en')
    render(<TwoTeams home={BRA} away={TBD} />)
    expect(screen.getByTestId('home')).toHaveTextContent('Brazil')
    expect(screen.getByTestId('away')).toHaveTextContent('TBD')

    await act(async () => {
      await i18n.changeLanguage('es')
    })
    expect(screen.getByTestId('home')).toHaveTextContent('Brasil')
    expect(screen.getByTestId('away')).toHaveTextContent('Por definir')
  })

  it('localizes the visible name inside MatchTeams under es (AC1)', async () => {
    await i18n.changeLanguage('es')
    render(
      <ThemeProvider theme={theme}>
        <MatchTeams homeTeam={BRA} awayTeam={TBD} center={<span>0–0</span>} />
      </ThemeProvider>,
    )
    expect(screen.getByText('Brasil')).toBeInTheDocument()
    expect(screen.getByText('Por definir')).toBeInTheDocument()
  })
})

describe('Spanish map coverage (AC6)', () => {
  it('has a non-empty Spanish name for every distinct non-TBD team in the seed/sample data', () => {
    const teams: Team[] = [
      ...sampleMatches.flatMap((m) => [m.homeTeam, m.awayTeam]),
      ...sampleStandings.flatMap((s) => s.table.map((row) => row.team)),
    ]
    const codes = new Set(teams.filter((t) => !isTbdTeam(t)).map((t) => t.tla.toUpperCase()))
    const missing = [...codes].filter((c) => !countryNamesEs[c])
    expect(missing, `Seed teams with no Spanish entry: ${missing.join(', ')}`).toEqual([])
  })

  it('has no blank entries in the Spanish map', () => {
    const blanks = Object.entries(countryNamesEs)
      .filter(([, name]) => !name || name.trim().length === 0)
      .map(([code]) => code)
    expect(blanks, `Blank Spanish names for: ${blanks.join(', ')}`).toEqual([])
  })
})
