/**
 * App — auth gate + multi-tenant routing (ticket 012).
 *
 * Auth gate (constitution: signed-out users see only Login):
 *   - while auth is resolving → full-screen LoadingState
 *   - signed out → LoginPage (Google sign-in)
 *   - signed in → the app (ANY signed-in user; there is no app-level membership gate)
 *
 * Routes:
 *   - `/`            → MyGroups (owned + joined + pending)
 *   - `/groups/new`  → create a group
 *   - `/join/:gid`   → request to join a group
 *   - `/superadmin`  → app-level god-view (ticket 014); only `isSuperAdmin` may see it
 *   - `/g/:gid/{fixtures,predictions,leaderboard,standings,admin}` → group-scoped app
 *
 * Group routes are wrapped in `<GroupProvider>`; a non-member of that group is shown the
 * per-group `MembershipGate`, and `/admin` is restricted to that group's admins. The
 * `firestore.rules` remain the real authority for every read/write.
 */
import Box from '@mui/material/Box'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { LoadingState } from './components/states'
import { useAuth } from './auth/useAuth'
import { GroupProvider } from './group/GroupProvider'
import GroupApp from './group/GroupApp'
import LoginPage from './pages/LoginPage'
import MyGroupsPage from './pages/MyGroupsPage'
import CreateGroupPage from './pages/CreateGroupPage'
import JoinGroupPage from './pages/JoinGroupPage'
import SuperadminPage from './pages/SuperadminPage'

/** Reads `:gid` from the route and provides the group context to the in-group app. */
function GroupRoute() {
  const { gid = '' } = useParams<{ gid: string }>()
  return (
    <GroupProvider gid={gid}>
      <GroupApp />
    </GroupProvider>
  )
}

function App() {
  const { user, loading, isSuperAdmin } = useAuth()

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

  return (
    <Routes>
      <Route path="/" element={<MyGroupsPage />} />
      <Route path="/groups/new" element={<CreateGroupPage />} />
      <Route path="/join/:gid" element={<JoinGroupPage />} />
      {/* App-level superadmin god-view (ticket 014): only the superadmin may see it;
          everyone else is redirected to My Groups. Rules remain the real gate. */}
      <Route
        path="/superadmin"
        element={isSuperAdmin ? <SuperadminPage /> : <Navigate to="/" replace />}
      />
      <Route path="/g/:gid/*" element={<GroupRoute />} />
      {/* Unknown paths fall back to My Groups. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
