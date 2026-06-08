/**
 * GroupApp — the in-group application shell + routes (ticket 012).
 *
 * Mounted under `/g/:gid/*` inside a `<GroupProvider>`. It:
 *   - shows a loading state while the group + the viewer's membership resolve,
 *   - shows the per-group `MembershipGate` when the viewer is NOT an approved member,
 *   - otherwise renders the responsive `AppShell` (group name as title, nav under
 *     `/g/:gid/...`, plus a "My Groups" way out and an Admin item for group-admins)
 *     wrapping the group-scoped feature routes.
 *
 * The `/admin` route is restricted to group-admins; `firestore.rules` is the real gate.
 */
import Box from '@mui/material/Box'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AppShell from '../components/AppShell'
import {
  defaultNavItems,
  adminNavItem,
  myGroupsNavItem,
  CANVAS_NAV_ITEM,
} from '../components/navItems'
import { LoadingState, ErrorState } from '../components/states'
import { useGroup } from './useGroup'
import { useAuth } from '../auth/useAuth'
import MembershipGate from '../pages/MembershipGate'
import FixturesPage from '../pages/FixturesPage'
import PredictionsPage from '../pages/PredictionsPage'
import LeaderboardPage from '../pages/LeaderboardPage'
import StandingsPage from '../pages/StandingsPage'
import AdminPage from '../pages/AdminPage'
import CanvasPage from '../pages/CanvasPage'

export function GroupApp() {
  const { gid, group, isGroupMember, isGroupAdmin, loading, error } = useGroup()
  const { isSuperAdmin } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  // Canvas design sandbox: app superadmin, or anyone running locally (`npm run dev`).
  const showCanvas = isSuperAdmin || import.meta.env.DEV

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <LoadingState rows={1} label={t('states.loadingGroup')} />
      </Box>
    )
  }

  if (error || !group) {
    return (
      <Box sx={{ p: 3 }}>
        <ErrorState
          title={t('membership.groupUnavailableTitle')}
          description={t('membership.groupUnavailableDescription')}
        />
      </Box>
    )
  }

  // Not an approved member (and not the owner) → per-group request/pending/rejected screen.
  if (!isGroupMember) {
    return <MembershipGate />
  }

  // Derive the selected nav key from the path: "/g/:gid/fixtures" → "fixtures".
  const segments = location.pathname.split('/').filter(Boolean) // ['g', gid, key]
  const selectedKey = segments[2] ?? 'fixtures'

  const navItems = [
    ...defaultNavItems(t),
    ...(isGroupAdmin ? [adminNavItem(t)] : []),
    ...(showCanvas ? [CANVAS_NAV_ITEM] : []),
    myGroupsNavItem(t),
  ]

  const handleNavigate = (key: string) => {
    if (key === 'groups') {
      navigate('/')
      return
    }
    navigate(`/g/${gid}/${key}`)
  }

  return (
    <AppShell
      title={group.name}
      navItems={navItems}
      selectedKey={selectedKey}
      onNavigate={handleNavigate}
    >
      <Routes>
        <Route index element={<Navigate to="fixtures" replace />} />
        <Route path="fixtures" element={<FixturesPage />} />
        <Route path="predictions" element={<PredictionsPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="standings" element={<StandingsPage />} />
        <Route
          path="admin"
          element={isGroupAdmin ? <AdminPage /> : <Navigate to="../fixtures" replace />}
        />
        <Route
          path="canvas"
          element={showCanvas ? <CanvasPage /> : <Navigate to="../fixtures" replace />}
        />
        <Route path="*" element={<Navigate to="fixtures" replace />} />
      </Routes>
    </AppShell>
  )
}

export default GroupApp
