import type { ReactNode } from 'react'
import { useId, useRef, useEffect } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import { useTranslation } from 'react-i18next'
import { layout } from '../theme/tokens'
import { defaultNavItems, type NavItem } from './navItems'
import { LanguageSwitcher } from './LanguageSwitcher'

export interface AppShellProps {
  /** Page content. */
  children?: ReactNode
  /** App title shown in the top app bar. */
  title?: string
  /**
   * Interactive control rendered in the app-bar title slot (e.g. a group switcher).
   * When provided, it replaces the plain title text; `title` is still used as the
   * document/accessible label fallback.
   */
  titleControl?: ReactNode
  /** Navigation destinations. Defaults to the in-group destinations. */
  navItems?: NavItem[]
  /** Currently selected nav item key (controlled). */
  selectedKey?: string
  /** Called with the item key when a destination is chosen. */
  onNavigate?: (key: string) => void
}

/**
 * Responsive MD3 application frame.
 *
 * - Top app bar with the app title.
 * - Mobile (`< sm`): bottom `BottomNavigation` bar.
 * - Desktop (`>= sm`): a left navigation rail (permanent `Drawer`).
 *
 * Routing is intentionally NOT wired here — the parent connects `navItems`,
 * `selectedKey` and `onNavigate` to its router.
 */
export function AppShell({
  children,
  title,
  titleControl,
  navItems,
  selectedKey,
  onNavigate,
}: AppShellProps) {
  const theme = useTheme()
  const { t } = useTranslation()
  // Mobile-first: rail appears at the `sm` breakpoint and up.
  const isDesktop = useMediaQuery(theme.breakpoints.up('sm'))
  const navLabelId = useId()

  const resolvedTitle = title ?? t('common.appName')
  const items = navItems ?? defaultNavItems(t)

  // Keep the active mobile-bar destination visible when there are more items than
  // fit the viewport (the bar scrolls horizontally — see `bottomBar`).
  const selectedActionRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    selectedActionRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [selectedKey])

  const handleSelect = (key: string) => {
    onNavigate?.(key)
  }

  const rail = (
    <Drawer
      variant="permanent"
      aria-label={t('appShell.primaryNav')}
      sx={{
        width: layout.navRailWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: layout.navRailWidth,
          boxSizing: 'border-box',
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        },
      }}
    >
      <Toolbar />
      <List
        component="nav"
        aria-labelledby={navLabelId}
        sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 1 }}
      >
        <Box
          component="span"
          id={navLabelId}
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
          }}
        >
          {t('appShell.primary')}
        </Box>
        {items.map((item) => {
          const selected = item.key === selectedKey
          return (
            <ListItemButton
              key={item.key}
              selected={selected}
              onClick={() => handleSelect(item.key)}
              aria-current={selected ? 'page' : undefined}
              sx={{
                flexDirection: 'column',
                borderRadius: 3,
                mx: 1,
                gap: 0.5,
                py: 1,
                '&.Mui-selected': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              <Box
                aria-hidden
                sx={{ display: 'flex', color: selected ? 'primary.main' : 'text.secondary' }}
              >
                {item.icon}
              </Box>
              <Typography
                variant="caption"
                sx={{ color: selected ? 'primary.main' : 'text.secondary' }}
              >
                {item.label}
              </Typography>
            </ListItemButton>
          )
        })}
      </List>
    </Drawer>
  )

  const bottomBar = (
    <Paper
      square
      elevation={3}
      sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: theme.zIndex.appBar }}
    >
      {/* Horizontally scrollable strip: with many destinations the bar overflows and
          can be swiped sideways instead of squishing the actions. Scrollbar hidden. */}
      <Box
        sx={{
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        <BottomNavigation
          showLabels
          value={selectedKey ?? false}
          onChange={(_, key: string) => handleSelect(key)}
          aria-label={t('appShell.primaryNav')}
          sx={{ width: 'max-content', minWidth: '100%', justifyContent: 'flex-start' }}
        >
          {items.map((item) => (
            <BottomNavigationAction
              key={item.key}
              ref={item.key === selectedKey ? selectedActionRef : undefined}
              value={item.key}
              label={item.label}
              icon={item.icon}
              // Keep a readable width and let the row overflow (scroll) rather than shrink.
              sx={{ flex: '1 0 auto', minWidth: 76, maxWidth: 168 }}
            />
          ))}
        </BottomNavigation>
      </Box>
    </Paper>
  )

  return (
    <Box sx={{ minHeight: '100dvh' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <SportsSoccerIcon sx={{ mr: 1 }} aria-hidden />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {titleControl ?? (
              <Typography variant="h6" component="h1" noWrap>
                {resolvedTitle}
              </Typography>
            )}
          </Box>
          <LanguageSwitcher />
        </Toolbar>
      </AppBar>

      <Stack direction="row" sx={{ minHeight: '100dvh' }}>
        {isDesktop && rail}

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: '100%',
            // Offset for the fixed app bar + breathing room.
            pt: { xs: 10, sm: 10 },
            px: { xs: 2, sm: 3 },
            pb: { xs: 10, sm: 3 }, // room for the bottom bar on mobile
          }}
        >
          {children}
        </Box>
      </Stack>

      {!isDesktop && bottomBar}
    </Box>
  )
}

export default AppShell
