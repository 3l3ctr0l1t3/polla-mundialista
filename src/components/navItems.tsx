import type { ReactNode } from 'react'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import EditNoteIcon from '@mui/icons-material/EditNote'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import StadiumIcon from '@mui/icons-material/Stadium'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import GroupsIcon from '@mui/icons-material/Groups'

export interface NavItem {
  /** Stable key used for selection + as React key. The group-scoped path segment. */
  key: string
  /** Visible label. */
  label: string
  /** Icon element (already constructed, e.g. `<CalendarMonthIcon />`). */
  icon: ReactNode
}

/**
 * In-group navigation destinations (ticket 012). The `key` is the trailing route
 * segment under `/g/:gid/...`. The app shell prepends the group id when navigating.
 */
export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { key: 'fixtures', label: 'Fixtures', icon: <CalendarMonthIcon /> },
  { key: 'predictions', label: 'Predictions', icon: <EditNoteIcon /> },
  { key: 'leaderboard', label: 'Leaderboard', icon: <LeaderboardIcon /> },
  { key: 'standings', label: 'Standings', icon: <StadiumIcon /> },
]

/**
 * Admin destination (ticket 012). Appended to {@link DEFAULT_NAV_ITEMS} by the app
 * shell only when the viewer is an admin of the current group.
 */
export const ADMIN_NAV_ITEM: NavItem = {
  key: 'admin',
  label: 'Admin',
  icon: <HowToRegIcon />,
}

/**
 * "My Groups" destination (ticket 012). The way back out of a group to the group list.
 */
export const MY_GROUPS_NAV_ITEM: NavItem = {
  key: 'groups',
  label: 'My Groups',
  icon: <GroupsIcon />,
}
