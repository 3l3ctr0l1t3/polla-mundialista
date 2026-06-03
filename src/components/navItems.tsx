import type { ReactNode } from 'react'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import EditNoteIcon from '@mui/icons-material/EditNote'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import StadiumIcon from '@mui/icons-material/Stadium'

export interface NavItem {
  /** Stable key used for selection + as React key. */
  key: string
  /** Visible label. */
  label: string
  /** Icon element (already constructed, e.g. `<CalendarMonthIcon />`). */
  icon: ReactNode
}

/**
 * Default navigation destinations. The parent app may pass its own `navItems`
 * (e.g. wired to react-router); these are sensible placeholders so AppShell is
 * self-contained and importable on its own.
 */
export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { key: 'fixtures', label: 'Fixtures', icon: <CalendarMonthIcon /> },
  { key: 'predictions', label: 'Predictions', icon: <EditNoteIcon /> },
  { key: 'leaderboard', label: 'Leaderboard', icon: <LeaderboardIcon /> },
  { key: 'standings', label: 'Standings', icon: <StadiumIcon /> },
]
