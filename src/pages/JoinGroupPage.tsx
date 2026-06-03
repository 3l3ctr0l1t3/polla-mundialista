/**
 * JoinGroupPage (`/join/:gid`) — request to join a group via an invite link (ticket 012).
 *
 * Shows the group's name (group reads are open per `firestore.rules`). Behaviour keys off
 * the viewer's own `groups/{gid}/members/{uid}` doc + the group's `ownerUid`:
 *   - owner / approved  → "Open group" (already in).
 *   - pending           → "Awaiting approval".
 *   - rejected          → "Request again" (flips the doc back to pending).
 *   - no doc            → "Request to join" (self-creates a pending member doc).
 *
 * Writes match the rules-enforced shapes exactly. A rejected write surfaces in a snackbar;
 * the security rules are the real authority.
 */
import { useEffect, useState } from 'react'
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
import LoginIcon from '@mui/icons-material/Login'
import { onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { groupDoc, groupMemberDoc } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import { LoadingState } from '../components/states'
import type { Group, MemberStatus } from '../shared/types'

export function JoinGroupPage() {
  const { gid = '' } = useParams<{ gid: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [group, setGroup] = useState<Group | null>(null)
  const [groupLoaded, setGroupLoaded] = useState(false)
  const [status, setStatus] = useState<MemberStatus | null>(null)
  const [memberLoaded, setMemberLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOwner = !!group && !!user && group.ownerUid === user.uid

  useEffect(() => {
    setGroupLoaded(false)
    const unsubscribe = onSnapshot(
      groupDoc(gid),
      (snap) => {
        setGroup(snap.exists() ? snap.data() : null)
        setGroupLoaded(true)
      },
      () => setGroupLoaded(true),
    )
    return unsubscribe
  }, [gid])

  useEffect(() => {
    if (!user) {
      setMemberLoaded(true)
      return
    }
    setMemberLoaded(false)
    const unsubscribe = onSnapshot(
      groupMemberDoc(gid, user.uid),
      (snap) => {
        setStatus(snap.exists() ? snap.data().status : null)
        setMemberLoaded(true)
      },
      () => {
        setStatus(null)
        setMemberLoaded(true)
      },
    )
    return unsubscribe
  }, [gid, user])

  const handleRequest = async () => {
    if (!user) return
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
    if (!user) return
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

  if (!groupLoaded || !memberLoaded) {
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

  const approved = isOwner || status === 'approved'

  // Pick the icon + copy + action for the current state.
  const view = !group
    ? {
        icon: <DoNotDisturbIcon fontSize="inherit" />,
        color: 'error.main' as const,
        heading: 'Group not found',
        body: 'This invite link is invalid or the group no longer exists.',
        primary: null,
      }
    : approved
      ? {
          icon: <LoginIcon fontSize="inherit" />,
          color: 'primary.main' as const,
          heading: "You're in",
          body: `You're a member of ${group.name}.`,
          primary: {
            label: `Open ${group.name}`,
            onClick: () => navigate(`/g/${gid}/fixtures`),
            icon: <LoginIcon />,
          },
        }
      : status === 'pending'
        ? {
            icon: <HourglassTopIcon fontSize="inherit" />,
            color: 'info.main' as const,
            heading: 'Request pending',
            body: `Your request to join ${group.name} is awaiting approval from its admin.`,
            primary: null,
          }
        : status === 'rejected'
          ? {
              icon: <DoNotDisturbIcon fontSize="inherit" />,
              color: 'error.main' as const,
              heading: 'Not approved',
              body: `Your request to join ${group.name} wasn't approved. You can ask again.`,
              primary: { label: 'Request again', onClick: handleReRequest, icon: <GroupAddIcon /> },
            }
          : {
              icon: <GroupAddIcon fontSize="inherit" />,
              color: 'primary.main' as const,
              heading: `Join ${group.name}`,
              body: 'Send a request and the group admin will let you in.',
              primary: { label: 'Request to join', onClick: handleRequest, icon: <GroupAddIcon /> },
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
              <Button variant="outlined" component={RouterLink} to="/" disabled={busy} fullWidth>
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

export default JoinGroupPage
