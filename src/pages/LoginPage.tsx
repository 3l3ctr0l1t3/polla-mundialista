/**
 * LoginPage — the only page reachable while signed out OR signed in but not a member.
 *
 * Two states:
 *   - Signed out: a Google sign-in button.
 *   - Signed in but NOT on the allowlist: an "ask the organizer to add you" message
 *     plus a sign-out action.
 *
 * PENDING RUNTIME STEP: sign-in only succeeds once the Google provider is enabled in
 * the Firebase console (`la-pollita-corp`). A provider-disabled error surfaces in the
 * snackbar below.
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
import GoogleIcon from '@mui/icons-material/Google'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import LockPersonIcon from '@mui/icons-material/LockPerson'
import { signInWithGoogle, signOutUser } from '../firebase/auth'
import { useAuth } from '../auth/useAuth'

export function LoginPage() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A user object here means signed in but not a member (the route guard only renders
  // LoginPage for members-failing cases).
  const isNonMember = user !== null

  const handleSignIn = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
      // On success AuthProvider takes over; App swaps to the member shell or the
      // not-a-member state below.
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(
        code === 'auth/popup-closed-by-user'
          ? 'Sign-in was cancelled.'
          : 'Could not sign in. Please try again.',
      )
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
            <Box
              aria-hidden
              sx={{
                display: 'flex',
                color: isNonMember ? 'warning.main' : 'primary.main',
                fontSize: 56,
              }}
            >
              {isNonMember ? (
                <LockPersonIcon fontSize="inherit" />
              ) : (
                <SportsSoccerIcon fontSize="inherit" />
              )}
            </Box>

            <Stack spacing={1}>
              <Typography variant="h5" component="h1">
                Polla Mundialista
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isNonMember
                  ? 'FIFA World Cup 2026 prediction pool'
                  : 'Sign in to make your predictions and climb the leaderboard.'}
              </Typography>
            </Stack>

            {isNonMember ? (
              <Stack spacing={2} sx={{ width: '100%' }}>
                <Typography variant="body1" color="text.primary">
                  You&apos;re signed in as <strong>{user?.email}</strong>, but this account
                  isn&apos;t on the pool&apos;s guest list yet.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ask the organizer to add your email, then sign in again.
                </Typography>
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
            ) : (
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<GoogleIcon />}
                onClick={handleSignIn}
                disabled={busy}
                fullWidth
                sx={{ borderRadius: 8, py: 1.25 }}
              >
                Sign in with Google
              </Button>
            )}
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

export default LoginPage
