/**
 * LoginPage — the only page reachable while signed OUT.
 *
 * Renders a Google sign-in button. Once signed in, AuthProvider takes over and App
 * routes to either the membership gate (non-members) or the app shell (members) — so
 * LoginPage no longer handles the "not a member" case (see `MembershipGate`).
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
import { useTranslation } from 'react-i18next'
import { signInWithGoogle } from '../firebase/auth'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

export function LoginPage() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
      // On success AuthProvider takes over; App swaps to the membership gate or shell.
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(
        code === 'auth/popup-closed-by-user' ? t('auth.signInCancelled') : t('auth.signInFailed'),
      )
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
        px: 2,
      }}
    >
      <Card elevation={3} sx={{ width: '100%', maxWidth: 420, borderRadius: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Box sx={{ alignSelf: 'flex-end' }}>
              <LanguageSwitcher />
            </Box>

            <Box aria-hidden sx={{ display: 'flex', color: 'primary.main', fontSize: 56 }}>
              <SportsSoccerIcon fontSize="inherit" />
            </Box>

            <Stack spacing={1}>
              <Typography variant="h5" component="h1">
                {t('common.appName')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('auth.tagline')}
              </Typography>
            </Stack>

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
              {t('auth.signInWithGoogle')}
            </Button>
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
