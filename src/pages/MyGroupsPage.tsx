/**
 * MyGroupsPage (`/`) — the signed-in user's landing screen (ticket 012).
 *
 * Lists the groups the user owns + has joined (each a card linking into the group's
 * fixtures), surfaces any pending join requests, and offers "Create group" + "Join via
 * link" affordances. Any signed-in user reaches this page — there is no app-level gate.
 *
 * Data comes from `useMyGroups` (three live `onSnapshot` slices). Provides
 * Loading / Empty / Error states.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import AddIcon from '@mui/icons-material/Add'
import LinkIcon from '@mui/icons-material/Link'
import GroupsIcon from '@mui/icons-material/Groups'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import LogoutIcon from '@mui/icons-material/Logout'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { signOutUser } from '../firebase/auth'
import { useMyGroups, type JoinedGroup } from '../hooks/useMyGroups'
import { LoadingState, EmptyState, ErrorState } from '../components/states'
import type { Group } from '../shared/types'

/** Parse a pasted invite link or raw id into a group id; '' if none found. */
function parseGid(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  // Accept a full /join/:gid URL or path, or a bare id.
  const match = trimmed.match(/join\/([^/?#]+)/)
  return match ? match[1] : trimmed
}

function GroupCard({ group, badge }: { group: Group; badge?: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardActionArea component={RouterLink} to={`/g/${group.groupId}/fixtures`}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'primary.main' }} aria-hidden>
              {group.name.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="subtitle1" noWrap>
                {group.name}
              </Typography>
            </Box>
            {badge && <Chip size="small" color="primary" variant="outlined" label={badge} />}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

function PendingCard({ entry }: { entry: JoinedGroup }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, opacity: 0.85 }}>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Avatar
            sx={{ bgcolor: 'action.disabledBackground', color: 'text.secondary' }}
            aria-hidden
          >
            <HourglassTopIcon fontSize="small" />
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" noWrap>
              {entry.group.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Awaiting approval
            </Typography>
          </Box>
          <Button
            size="small"
            component={RouterLink}
            to={`/join/${entry.group.groupId}`}
            aria-label={`View join status for ${entry.group.name}`}
          >
            View
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function MyGroupsPage() {
  const { owned, approved, pending, loading, error } = useMyGroups()
  const navigate = useNavigate()
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinInput, setJoinInput] = useState('')

  const handleJoin = () => {
    const gid = parseGid(joinInput)
    if (!gid) return
    setJoinOpen(false)
    setJoinInput('')
    navigate(`/join/${gid}`)
  }

  const hasAny = owned.length > 0 || approved.length > 0 || pending.length > 0

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%' }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 1 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <GroupsIcon aria-hidden color="primary" />
          <Typography variant="h5" component="h1">
            My Groups
          </Typography>
        </Stack>
        <Button
          size="small"
          color="inherit"
          startIcon={<LogoutIcon />}
          onClick={() => void signOutUser()}
        >
          Sign out
        </Button>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/groups/new">
          Create group
        </Button>
        <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => setJoinOpen(true)}>
          Join via link
        </Button>
      </Stack>

      {loading ? (
        <LoadingState rows={3} label="Loading your groups" />
      ) : error ? (
        <ErrorState title="Couldn't load your groups" description={error.message} />
      ) : !hasAny ? (
        <EmptyState
          icon={<GroupsIcon fontSize="inherit" />}
          title="No groups yet"
          description="Create your own pool or join a friend's with their invite link."
        />
      ) : (
        <Stack spacing={3}>
          {owned.length > 0 && (
            <Box component="section" aria-label="Groups you own">
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                Owned
              </Typography>
              <Stack spacing={1.5}>
                {owned.map((g) => (
                  <GroupCard key={g.groupId} group={g} badge="Owner" />
                ))}
              </Stack>
            </Box>
          )}

          {approved.length > 0 && (
            <Box component="section" aria-label="Groups you've joined">
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                Joined
              </Typography>
              <Stack spacing={1.5}>
                {approved.map((j) => (
                  <GroupCard key={j.group.groupId} group={j.group} />
                ))}
              </Stack>
            </Box>
          )}

          {pending.length > 0 && (
            <Box component="section" aria-label="Pending requests">
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                Pending requests
              </Typography>
              <Stack spacing={1.5}>
                {pending.map((j) => (
                  <PendingCard key={j.group.groupId} entry={j} />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}

      <Dialog open={joinOpen} onClose={() => setJoinOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Join via link</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Invite link or group id"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoin()
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleJoin} disabled={!parseGid(joinInput)}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default MyGroupsPage
