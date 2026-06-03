/**
 * MembershipGate — the screen shown to a signed-in user who is NOT yet a member.
 *
 * Three sub-states keyed off `memberStatus` from `useAuth()`:
 *   - `null`     → "Request to join": a button that self-creates `members/{uid}` with
 *                  `status: 'pending'`.
 *   - `pending`  → "Awaiting approval": informational, with sign-out.
 *   - `rejected` → "Not approved": a re-request button that flips the doc back to
 *                  `pending` (allowed for the owner by `firestore.rules`).
 *
 * The signed-OUT case is handled by `LoginPage`, not here. The `approved`/admin case
 * never reaches this component (App routes members to the app shell).
 *
 * Writes are convenience-gated in the UI; `firestore.rules` is the real authority. A
 * rejected write surfaces in the snackbar.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb'
import { serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { signOutUser } from '../firebase/auth'
import { memberDoc } from '../firebase/db'
import { useAuth } from '../auth/useAuth'

export function MembershipGate() {
  const { user, memberStatus } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // App only mounts this for a signed-in non-member; guard defensively anyway.
  if (!user) return null

  const handleRequestToJoin = async () => {
    setBusy(true)
    setError(null)
    try {
      await setDoc(memberDoc(user.uid), {
        uid: user.uid,
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL ?? null,
        status: 'pending',
        requestedAt: serverTimestamp(),
        decidedAt: null,
        decidedBy: null,
      })
      // The members/{uid} onSnapshot in AuthProvider flips us to the pending view.
    } catch {
      setError('Could not send your request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleReRequest = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateDoc(memberDoc(user.uid), {
        status: 'pending',
        decidedAt: null,
        decidedBy: null,
      })
    } catch {
      setError('Could not resubmit your request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    try {
      await signOutUser()
    } catch {
      setError('Could not sign out. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // Pick the icon + copy for the current sub-state.
  const view =
    memberStatus === 'pending'
      ? {
          icon: <HourglassTopIcon fontSize="inherit" />,
          color: 'info.main' as const,
          heading: 'Request pending',
          body: 'Your request to join is awaiting approval from the organizer. You’ll get in as soon as it’s approved.',
          primary: null,
        }
      : memberStatus === 'rejected'
        ? {
            icon: <DoNotDisturbIcon fontSize="inherit" />,
            color: 'error.main' as const,
            heading: 'Not approved',
            body: 'Your request to join wasn’t approved. If you think this was a mistake, you can ask again.',
            primary: {
              label: 'Request again',
              onClick: handleReRequest,
              icon: <GroupAddIcon />,
            },
          }
        : {
            icon: <GroupAddIcon fontSize="inherit" />,
            color: 'primary.main' as const,
            heading: 'Request to join',
            body: 'You’re signed in but not yet part of the pool. Send a request and the organizer will let you in.',
            primary: {
              label: 'Request to join',
              onClick: handleRequestToJoin,
              icon: <GroupAddIcon />,
            },
          }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Card elevation={3} sx={{ width: '100%', maxWidth: 420, borderRadius: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Box aria-hidden sx={{ display: 'flex', color: view.color, fontSize: 56 }}>
              {view.icon}
            </Box>

            <Stack spacing={1}>
              <Typography variant="h5" component="h1">
                {view.heading}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {view.body}
              </Typography>
            </Stack>

            <Typography variant="body2" color="text.secondary">
              Signed in as <strong>{user.email}</strong>
            </Typography>

            <Stack spacing={2} sx={{ width: '100%' }}>
              {view.primary && (
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={
                    busy ? <CircularProgress size={18} color="inherit" /> : view.primary.icon
                  }
                  onClick={view.primary.onClick}
                  disabled={busy}
                  fullWidth
                  sx={{ borderRadius: 8, py: 1.25 }}
                >
                  {view.primary.label}
                </Button>
              )}
              <Button
                variant="outlined"
                color="primary"
                onClick={handleSignOut}
                disabled={busy}
                fullWidth
              >
                Sign out
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar
        open={error !== null}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default MembershipGate
