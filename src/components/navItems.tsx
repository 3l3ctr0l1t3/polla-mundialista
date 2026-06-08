import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import StadiumIcon from '@mui/icons-material/Stadium'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import GroupsIcon from '@mui/icons-material/Groups'
import ScienceIcon from '@mui/icons-material/Science'

export interface NavItem {
  /** Stable key used for selection + as React key. The group-scoped path segment. */
  key: string
  /** Visible label (localized; built from `t('nav.*')`). */
  label: string
  /** Icon element (already constructed, e.g. `<CalendarMonthIcon />`). */
  icon: ReactNode
}

/**
 * In-group navigation destinations (ticket 012). The `key` is the trailing route
 * segment under `/g/:gid/...`. The app shell prepends the group id when navigating.
 *
 * Labels are derived from `t('nav.*')` so they re-evaluate on language change
 * (ticket 017); icons stay static. `GroupApp` rebuilds these each render with its
 * own `t` from `useTranslation()`.
 */
export function defaultNavItems(t: TFunction): NavItem[] {
  return [
    { key: 'fixtures', label: t('nav.fixtures'), icon: <CalendarMonthIcon /> },
    { key: 'leaderboard', label: t('nav.leaderboard'), icon: <LeaderboardIcon /> },
    { key: 'standings', label: t('nav.standings'), icon: <StadiumIcon /> },
  ]
}

/**
 * Admin destination (ticket 012). Appended to {@link defaultNavItems} by the app
 * shell only when the viewer is an admin of the current group.
 */
export function adminNavItem(t: TFunction): NavItem {
  return { key: 'admin', label: t('nav.admin'), icon: <HowToRegIcon /> }
}

/**
 * "My Groups" destination (ticket 012). The way back out of a group to the group list.
 */
export function myGroupsNavItem(t: TFunction): NavItem {
  return { key: 'groups', label: t('nav.myGroups'), icon: <GroupsIcon /> }
}

/**
 * Canvas design-sandbox destination. Appended by the app shell only for the app
 * superadmin (or in local dev). Not a user-facing feature — label stays English.
 */
export const CANVAS_NAV_ITEM: NavItem = {
  key: 'canvas',
  label: 'Canvas',
  icon: <ScienceIcon />,
}
