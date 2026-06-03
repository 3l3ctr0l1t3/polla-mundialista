/**
 * AdminPage — pending join-request approval for a group (ticket 012, `/g/:gid/admin`).
 *
 * Lists every `groups/{gid}/members/{uid}` with `status == 'pending'` (live via
 * `usePendingMembers(gid)`) and lets a GROUP admin Approve or Reject each one. A decision
 * writes `{ status, decidedBy: <adminUid>, decidedAt: serverTimestamp() }`.
 *
 * Only that group's admin can read other members' docs or change `status` — enforced by
 * `firestore.rules`. The route is also guarded in `App.tsx` (group-admins only) so
 * non-admins never mount this page; the security rules remain the real authority. A
 * rejected write surfaces in the snackbar.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import { serverTimestamp, updateDoc } from 'firebase/firestore'
import { groupMemberDoc } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import { useGroup } from '../group/useGroup'
import { usePendingMembers } from '../hooks/usePendingMembers'
import { LoadingState, EmptyState, ErrorState } from '../components/states'
import type { Member, MemberStatus } from '../shared/types'

/** A single pending-request row with Approve / Reject actions. */
function PendingRow({
  member,
  busy,
  onDecide,
}: {
  member: Member
  busy: boolean
  onDecide: (uid: string, status: Extract<MemberStatus, 'approved' | 'rejected'>) => void
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Avatar src={member.photoURL ?? undefined} alt="">
              {member.displayName?.charAt(0).toUpperCase() || '?'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap>
                {member.displayName || 'Unnamed'}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {member.email}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<CheckIcon />}
              disabled={busy}
              onClick={() => onDecide(member.uid, 'approved')}
              aria-label={`Approve ${member.displayName || member.email}`}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<CloseIcon />}
              disabled={busy}
              onClick={() => onDecide(member.uid, 'rejected')}
              aria-label={`Reject ${member.displayName || member.email}`}
            >
              Reject
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function AdminPage() {
  const { user } = useAuth()
  const { gid } = useGroup()
  const { members, loading, error } = usePendingMembers(gid)
  const [pendingUid, setPendingUid] = useState<string | null>(null)
  const [snack, setSnack] = useState<string | null>(null)

  const handleDecide = async (
    targetUid: string,
    status: Extract<MemberStatus, 'approved' | 'rejected'>,
  ) => {
    if (!user) return
    setPendingUid(targetUid)
    try {
      await updateDoc(groupMemberDoc(gid, targetUid), {
        status,
        decidedBy: user.uid,
        decidedAt: serverTimestamp(),
      })
    } catch {
      setSnack('Could not save that decision. Please try again.')
    } finally {
      setPendingUid(null)
    }
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
        <HowToRegIcon aria-hidden color="primary" />
        <Typography variant="h5" component="h2">
          Join requests
        </Typography>
      </Stack>

      {loading ? (
        <LoadingState rows={3} label="Loading join requests" />
      ) : error ? (
        <ErrorState title="Couldn't load requests" description={error.message} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={<HowToRegIcon fontSize="inherit" />}
          title="No pending requests"
          description="When someone asks to join this group, they'll show up here for approval."
        />
      ) : (
        <Stack spacing={1.5}>
          {members.map((m) => (
            <PendingRow
              key={m.uid}
              member={m}
              busy={pendingUid === m.uid}
              onDecide={handleDecide}
            />
          ))}
        </Stack>
      )}

      <Snackbar
        open={snack !== null}
        autoHideDuration={6000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setSnack(null)}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default AdminPage
