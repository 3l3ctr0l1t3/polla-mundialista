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
import AppShell from '../components/AppShell'
import { DEFAULT_NAV_ITEMS, ADMIN_NAV_ITEM, MY_GROUPS_NAV_ITEM } from '../components/navItems'
import { LoadingState, ErrorState } from '../components/states'
import { useGroup } from './useGroup'
import MembershipGate from '../pages/MembershipGate'
import FixturesPage from '../pages/FixturesPage'
import PredictionsPage from '../pages/PredictionsPage'
import LeaderboardPage from '../pages/LeaderboardPage'
import StandingsPage from '../pages/StandingsPage'
import AdminPage from '../pages/AdminPage'

export function GroupApp() {
  const { gid, group, isGroupMember, isGroupAdmin, loading, error } = useGroup()
  const location = useLocation()
  const navigate = useNavigate()

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
        <LoadingState rows={1} label="Loading group" />
      </Box>
    )
  }

  if (error || !group) {
    return (
      <Box sx={{ p: 3 }}>
        <ErrorState
          title="Group unavailable"
          description="This group could not be loaded. The invite link may be invalid."
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
    ...DEFAULT_NAV_ITEMS,
    ...(isGroupAdmin ? [ADMIN_NAV_ITEM] : []),
    MY_GROUPS_NAV_ITEM,
  ]

  const handleNavigate = (key: string) => {
    if (key === MY_GROUPS_NAV_ITEM.key) {
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
        <Route path="*" element={<Navigate to="fixtures" replace />} />
      </Routes>
    </AppShell>
  )
}

export default GroupApp
