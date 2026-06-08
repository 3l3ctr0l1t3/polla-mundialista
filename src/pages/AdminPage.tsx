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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import PeopleIcon from '@mui/icons-material/People'
import TuneIcon from '@mui/icons-material/Tune'
import LockIcon from '@mui/icons-material/Lock'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import { deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useTranslation } from 'react-i18next'
import { groupDoc, groupMemberDoc } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import { useGroup } from '../group/useGroup'
import { useServerTime } from '../hooks/useServerTime'
import { useTournamentConfig } from '../hooks/useTournamentConfig'
import { usePendingMembers } from '../hooks/usePendingMembers'
import { useApprovedMembers } from '../hooks/useApprovedMembers'
import { effectiveMode, LOCK_BUFFER_MS } from '../shared/predictionLock'
import { LoadingState, EmptyState, ErrorState } from '../components/states'
import type { Member, MemberStatus, PredictionMode } from '../shared/types'

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
  const { t } = useTranslation()
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
                {member.displayName || t('common.unnamed')}
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
              aria-label={t('admin.approveAria', { name: member.displayName || member.email })}
            >
              {t('admin.approve')}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<CloseIcon />}
              disabled={busy}
              onClick={() => onDecide(member.uid, 'rejected')}
              aria-label={t('admin.rejectAria', { name: member.displayName || member.email })}
            >
              {t('admin.reject')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

/** A single approved-member row with a destructive Remove action. */
function MemberRow({
  member,
  busy,
  onRemove,
}: {
  member: Member
  busy: boolean
  onRemove: (member: Member) => void
}) {
  const { t } = useTranslation()
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
                {member.displayName || t('common.unnamed')}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {member.email}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              disabled={busy}
              onClick={() => onRemove(member)}
              aria-label={t('admin.removeAria', { name: member.displayName || member.email })}
            >
              {t('admin.remove')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function AdminPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { gid, group } = useGroup()
  const { now } = useServerTime()
  const { cutoffs } = useTournamentConfig()
  const { members, loading, error } = usePendingMembers(gid)
  const {
    members: approvedMembers,
    loading: membersLoading,
    error: membersError,
  } = useApprovedMembers(gid)
  const [pendingUid, setPendingUid] = useState<string | null>(null)
  const [toRemove, setToRemove] = useState<Member | null>(null)
  const [removingUid, setRemovingUid] = useState<string | null>(null)
  const [savingMode, setSavingMode] = useState(false)
  const [snack, setSnack] = useState<string | null>(null)

  // The mode freezes 10 min before the first cup match (== the strict group-stage window).
  // Until `config/tournament` is seeded, treat as not-frozen (the tournament hasn't started).
  const mode = effectiveMode(group ?? {})
  const freezeInstantMs = cutoffs ? cutoffs.firstCupMatchKickoffMs - LOCK_BUFFER_MS : null
  const frozen = freezeInstantMs !== null && now() >= freezeInstantMs

  const handleModeChange = async (_e: unknown, next: PredictionMode | null) => {
    if (!next || next === mode || frozen) return
    setSavingMode(true)
    try {
      await updateDoc(groupDoc(gid), { mode: next })
    } catch {
      setSnack(t('admin.modeError'))
    } finally {
      setSavingMode(false)
    }
  }

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
      setSnack(t('admin.decisionError'))
    } finally {
      setPendingUid(null)
    }
  }

  const handleConfirmRemove = async () => {
    if (!toRemove) return
    setRemovingUid(toRemove.uid)
    try {
      await deleteDoc(groupMemberDoc(gid, toRemove.uid))
      setToRemove(null)
    } catch {
      setSnack(t('admin.removeError'))
    } finally {
      setRemovingUid(null)
    }
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <TuneIcon aria-hidden color="primary" />
        <Typography variant="h5" component="h2">
          {t('admin.predictionMode')}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('admin.predictionModeDescription')}
      </Typography>
      <ToggleButtonGroup
        exclusive
        color="primary"
        value={mode}
        onChange={handleModeChange}
        disabled={frozen || savingMode}
        aria-label={t('admin.predictionMode')}
        sx={{ mb: frozen ? 1 : 0 }}
      >
        <ToggleButton value="lazy" aria-label={t('admin.modeLazy')}>
          {t('admin.modeLazy')}
        </ToggleButton>
        <ToggleButton value="strict" aria-label={t('admin.modeStrict')}>
          {t('admin.modeStrict')}
        </ToggleButton>
      </ToggleButtonGroup>
      {frozen && (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 1 }}>
          <LockIcon fontSize="inherit" color="action" aria-hidden />
          <Typography variant="caption" color="text.secondary">
            {t('admin.modeFrozen')}
          </Typography>
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 4, mb: 2 }}>
        <HowToRegIcon aria-hidden color="primary" />
        <Typography variant="h5" component="h2">
          {t('admin.joinRequests')}
        </Typography>
      </Stack>

      {loading ? (
        <LoadingState rows={3} label={t('admin.loadingRequests')} />
      ) : error ? (
        <ErrorState title={t('admin.requestsErrorTitle')} description={error.message} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={<HowToRegIcon fontSize="inherit" />}
          title={t('admin.noRequestsTitle')}
          description={t('admin.noRequestsDescription')}
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

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 4, mb: 2 }}>
        <PeopleIcon aria-hidden color="primary" />
        <Typography variant="h5" component="h2">
          {t('admin.members')}
        </Typography>
      </Stack>

      {membersLoading ? (
        <LoadingState rows={3} label={t('admin.loadingMembers')} />
      ) : membersError ? (
        <ErrorState title={t('admin.membersErrorTitle')} description={membersError.message} />
      ) : approvedMembers.length === 0 ? (
        <EmptyState
          icon={<PeopleIcon fontSize="inherit" />}
          title={t('admin.noMembersTitle')}
          description={t('admin.noMembersDescription')}
        />
      ) : (
        <Stack spacing={1.5}>
          {approvedMembers
            .filter((m) => m.uid !== user?.uid)
            .map((m) => (
              <MemberRow
                key={m.uid}
                member={m}
                busy={removingUid === m.uid}
                onRemove={setToRemove}
              />
            ))}
        </Stack>
      )}

      <Dialog
        open={toRemove !== null}
        onClose={() => (removingUid ? undefined : setToRemove(null))}
        aria-labelledby="remove-member-title"
      >
        <DialogTitle id="remove-member-title">{t('admin.removeDialogTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('admin.removeConfirm', {
              name: toRemove?.displayName || toRemove?.email || t('admin.thisMember'),
              group: group?.name || t('admin.thisGroup'),
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToRemove(null)} disabled={removingUid !== null}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            disabled={removingUid !== null}
            onClick={handleConfirmRemove}
          >
            {t('admin.remove')}
          </Button>
        </DialogActions>
      </Dialog>

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
