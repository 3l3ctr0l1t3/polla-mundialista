/**
 * CreateGroupPage (`/groups/new`) — create a new pool you own (ticket 012).
 *
 * A name input → on submit, a SINGLE `setDoc(groups/{gid}, …)` write with `ownerUid == me`
 * (the owner is implicit — there is NO owner member doc). The group id is generated client
 * side via `doc(groupsCol)`. On success the page shows the shareable invite link and a
 * button to enter the group.
 *
 * The write shape is exactly what `firestore.rules` allows for a self-created group. A
 * rejected write surfaces in the snackbar; rules are the real authority.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { groupsCol, groupDoc } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import { generateInviteCode } from '../group/inviteCode'

export function CreateGroupPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ gid: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const inviteUrl = created ? `${window.location.origin}/join/${created.gid}` : ''

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!user || !trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      // Generate the id client-side so we can navigate to it immediately.
      const gid = doc(groupsCol).id
      await setDoc(groupDoc(gid), {
        groupId: gid,
        name: trimmed,
        ownerUid: user.uid,
        inviteCode: generateInviteCode(),
        createdAt: serverTimestamp() as never,
      })
      setCreated({ gid, name: trimmed })
    } catch {
      setError('Could not create the group. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
    } catch {
      setError('Could not copy the link. You can select and copy it manually.')
    }
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', width: '100%' }}>
      <Button
        component={RouterLink}
        to="/"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 2 }}
      >
        My Groups
      </Button>

      <Card variant="outlined" sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          {created ? (
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Typography variant="h5" component="h1">
                  {created.name} is ready
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Share this link so friends can request to join. You approve each request.
                </Typography>
              </Stack>

              <TextField
                label="Invite link"
                value={inviteUrl}
                fullWidth
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton aria-label="Copy invite link" onClick={handleCopy} edge="end">
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Button
                variant="contained"
                fullWidth
                onClick={() => navigate(`/g/${created.gid}/fixtures`)}
              >
                Go to {created.name}
              </Button>
            </Stack>
          ) : (
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Typography variant="h5" component="h1">
                  Create a group
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You'll be its admin and get an invite link to share.
                </Typography>
              </Stack>

              <TextField
                label="Group name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate()
                }}
                fullWidth
                autoFocus
                disabled={busy}
              />

              <Button
                variant="contained"
                size="large"
                startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
                onClick={handleCreate}
                disabled={busy || name.trim().length === 0}
                fullWidth
              >
                Create group
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setCopied(false)}>
          Invite link copied
        </Alert>
      </Snackbar>

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

export default CreateGroupPage
