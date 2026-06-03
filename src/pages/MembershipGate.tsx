/**
 * MembershipGate — shown when a signed-in user opens `/g/:gid/*` but is NOT yet an
 * approved member of THAT group (ticket 012, per-group generalization of ticket 011).
 *
 * Keys off the viewer's status from `useGroup()` (owner/approved never reach here):
 *   - `null`     → "Request to join": self-creates `groups/{gid}/members/{uid}` pending.
 *   - `pending`  → "Awaiting approval".
 *   - `rejected` → "Request again": flips the member doc back to pending.
 *
 * Writes match the rules-enforced shapes. A rejected write surfaces in the snackbar;
 * `firestore.rules` is the real authority.
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
import { Link as RouterLink } from 'react-router-dom'
import { groupMemberDoc } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import { useGroup } from '../group/useGroup'

export function MembershipGate() {
  const { user } = useAuth()
  const { gid, group, status } = useGroup()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const groupName = group?.name ?? 'this group'

  const handleRequestToJoin = async () => {
    setBusy(true)
    setError(null)
    try {
      await setDoc(groupMemberDoc(gid, user.uid), {
        uid: user.uid,
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL ?? null,
        role: 'member',
        status: 'pending',
        requestedAt: serverTimestamp() as never,
        decidedAt: null,
        decidedBy: null,
      })
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
      await updateDoc(groupMemberDoc(gid, user.uid), {
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

  const view =
    status === 'pending'
      ? {
          icon: <HourglassTopIcon fontSize="inherit" />,
          color: 'info.main' as const,
          heading: 'Request pending',
          body: `Your request to join ${groupName} is awaiting approval from its admin.`,
          primary: null,
        }
      : status === 'rejected'
        ? {
            icon: <DoNotDisturbIcon fontSize="inherit" />,
            color: 'error.main' as const,
            heading: 'Not approved',
            body: `Your request to join ${groupName} wasn't approved. You can ask again.`,
            primary: { label: 'Request again', onClick: handleReRequest, icon: <GroupAddIcon /> },
          }
        : {
            icon: <GroupAddIcon fontSize="inherit" />,
            color: 'primary.main' as const,
            heading: `Join ${groupName}`,
            body: "You're not a member of this group yet. Send a request and its admin will let you in.",
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
                component={RouterLink}
                to="/"
                disabled={busy}
                fullWidth
              >
                My Groups
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
