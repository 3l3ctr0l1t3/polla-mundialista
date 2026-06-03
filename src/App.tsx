/**
 * App — route guard + member shell.
 *
 * Auth gate (constitution: unauthenticated/non-member users see only LoginPage):
 *   - while auth is resolving → full-screen LoadingState
 *   - signed out OR not a member → LoginPage (which renders the right sub-state)
 *   - signed-in member → AppShell wrapping the feature routes
 *
 * The feature pages are stubs (tickets 004/005/007 replace them) but the routing,
 * nav selection, and navigation wiring are real.
 */
import Box from '@mui/material/Box'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import { DEFAULT_NAV_ITEMS } from './components/navItems'
import { LoadingState } from './components/states'
import { useAuth } from './auth/useAuth'
import LoginPage from './pages/LoginPage'
import FixturesPage from './pages/FixturesPage'
import PredictionsPage from './pages/PredictionsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import StandingsPage from './pages/StandingsPage'

/** Nav keys are the same as their route paths (without the leading slash). */
function MemberApp() {
  const location = useLocation()
  const navigate = useNavigate()

  // Derive the selected nav key from the current path (e.g. "/fixtures" → "fixtures").
  const selectedKey = location.pathname.split('/')[1] || 'fixtures'

  return (
    <AppShell
      navItems={DEFAULT_NAV_ITEMS}
      selectedKey={selectedKey}
      onNavigate={(key) => navigate(`/${key}`)}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/fixtures" replace />} />
        <Route path="/fixtures" element={<FixturesPage />} />
        <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/standings" element={<StandingsPage />} />
        {/* Unknown paths fall back to fixtures. */}
        <Route path="*" element={<Navigate to="/fixtures" replace />} />
      </Routes>
    </AppShell>
  )
}

function App() {
  const { user, loading, isMember } = useAuth()

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

  // Signed out OR signed in but not on the allowlist → LoginPage only.
  if (!user || !isMember) {
    return <LoginPage />
  }

  return <MemberApp />
}

export default App
