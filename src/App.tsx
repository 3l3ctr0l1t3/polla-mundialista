/**
 * App — route guard + member shell.
 *
 * Auth gate (constitution: unauthenticated/non-member users see only the gate screens):
 *   - while auth is resolving → full-screen LoadingState
 *   - signed out → LoginPage (Google sign-in)
 *   - signed in but NOT a member → MembershipGate (request-to-join / pending / rejected)
 *   - signed-in member (admin or approved) → AppShell wrapping the feature routes
 *
 * Membership (ticket 011) is `isAdmin || members/{uid}.status === 'approved'`. The
 * `/admin` route + nav item are shown only to admins; `firestore.rules` is the real
 * authority for both reads and writes.
 */
import Box from '@mui/material/Box'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import { DEFAULT_NAV_ITEMS, ADMIN_NAV_ITEM } from './components/navItems'
import { LoadingState } from './components/states'
import { useAuth } from './auth/useAuth'
import LoginPage from './pages/LoginPage'
import MembershipGate from './pages/MembershipGate'
import FixturesPage from './pages/FixturesPage'
import PredictionsPage from './pages/PredictionsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import StandingsPage from './pages/StandingsPage'
import AdminPage from './pages/AdminPage'

/** Nav keys are the same as their route paths (without the leading slash). */
function MemberApp({ isAdmin }: { isAdmin: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()

  // Derive the selected nav key from the current path (e.g. "/fixtures" → "fixtures").
  const selectedKey = location.pathname.split('/')[1] || 'fixtures'

  const navItems = isAdmin ? [...DEFAULT_NAV_ITEMS, ADMIN_NAV_ITEM] : DEFAULT_NAV_ITEMS

  return (
    <AppShell
      navItems={navItems}
      selectedKey={selectedKey}
      onNavigate={(key) => navigate(`/${key}`)}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/fixtures" replace />} />
        <Route path="/fixtures" element={<FixturesPage />} />
        <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/standings" element={<StandingsPage />} />
        {/* Admin-only: non-admins are redirected away from /admin. */}
        <Route
          path="/admin"
          element={isAdmin ? <AdminPage /> : <Navigate to="/fixtures" replace />}
        />
        {/* Unknown paths fall back to fixtures. */}
        <Route path="*" element={<Navigate to="/fixtures" replace />} />
      </Routes>
    </AppShell>
  )
}

function App() {
  const { user, loading, isMember, isAdmin } = useAuth()

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
        <LoadingState rows={1} label="Checking your session" />
      </Box>
    )
  }

  // Signed out → Google sign-in.
  if (!user) {
    return <LoginPage />
  }

  // Signed in but not yet a member → request-to-join / pending / rejected screens.
  if (!isMember) {
    return <MembershipGate />
  }

  return <MemberApp isAdmin={isAdmin} />
}

export default App
