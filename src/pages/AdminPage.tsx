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
import { useState, useEffect } from 'react'
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
import TextField from '@mui/material/TextField'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import PeopleIcon from '@mui/icons-material/People'
import TuneIcon from '@mui/icons-material/Tune'
import LockIcon from '@mui/icons-material/Lock'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import { deleteDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useTranslation } from 'react-i18next'
import { groupDoc, groupMemberDoc, groupPredictionDoc, matchesCol } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import { useGroup } from '../group/useGroup'
import { useServerTime } from '../hooks/useServerTime'
import { useTournamentConfig } from '../hooks/useTournamentConfig'
import { usePendingMembers } from '../hooks/usePendingMembers'
import { useApprovedMembers } from '../hooks/useApprovedMembers'
import { effectiveMode, LOCK_BUFFER_MS } from '../shared/predictionLock'
import { effectiveScoring } from '../shared/scoring'
import type { ScoringConfig } from '../shared/scoring'
import { LoadingState, EmptyState, ErrorState } from '../components/states'
import type { Group, Member, MemberStatus, PredictionMode } from '../shared/types'

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

/** The seven scoring stages + their localized label key, in display order. */
const SCORING_STAGES: { stage: string; labelKey: string }[] = [
  { stage: 'GROUP_STAGE', labelKey: 'scoring.stageGroup' },
  { stage: 'LAST_32', labelKey: 'scoring.stageRoundOf32' },
  { stage: 'LAST_16', labelKey: 'scoring.stageRoundOf16' },
  { stage: 'QUARTER_FINALS', labelKey: 'scoring.stageQuarterFinals' },
  { stage: 'SEMI_FINALS', labelKey: 'scoring.stageSemiFinals' },
  { stage: 'THIRD_PLACE', labelKey: 'scoring.stageThirdPlace' },
  { stage: 'FINAL', labelKey: 'scoring.stageFinal' },
]

/** Coerce any input to a non-negative integer (the rules reject floats/negatives). */
const toNonNegInt = (v: string | number): number => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * ScoringSection — the admin-only per-group scoring editor (ticket 025).
 *
 * Prefilled from the group's EFFECTIVE config (`effectiveScoring` = the group's
 * optional override merged over the engine defaults). Saving writes the COMPLETE
 * config object to `groups/{gid}.scoring` (the shape `firestore.rules` validates).
 * Disabled once `frozen` (the same first-kickoff freeze the prediction mode uses).
 */
function ScoringSection({
  gid,
  group,
  frozen,
  onError,
}: {
  gid: string
  group: Group | null
  frozen: boolean
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const [cfg, setCfg] = useState<ScoringConfig>(() => effectiveScoring(group ?? {}))
  const [saving, setSaving] = useState(false)

  // Re-sync the form when the group's scoring loads/changes.
  useEffect(() => {
    setCfg(effectiveScoring(group ?? {}))
  }, [group])

  const disabled = frozen || saving

  const setBase = (key: 'exact' | 'outcome' | 'goalDiffBonus', v: string) =>
    setCfg((c) => ({ ...c, [key]: toNonNegInt(v) }))
  const setBonus = (stage: string, v: string) =>
    setCfg((c) => ({ ...c, roundBonus: { ...c.roundBonus, [stage]: toNonNegInt(v) } }))

  const handleSave = async () => {
    if (frozen) return
    setSaving(true)
    try {
      const payload: ScoringConfig = {
        exact: toNonNegInt(cfg.exact),
        outcome: toNonNegInt(cfg.outcome),
        goalDiffBonus: toNonNegInt(cfg.goalDiffBonus),
        goalDiffOnlyOnCorrectOutcome: cfg.goalDiffOnlyOnCorrectOutcome,
        gradeOn: 'fullTime90',
        roundBonus: SCORING_STAGES.reduce<Record<string, number>>(
          (acc, { stage }) => ({ ...acc, [stage]: toNonNegInt(cfg.roundBonus[stage] ?? 0) }),
          {},
        ),
      }
      await updateDoc(groupDoc(gid), { scoring: payload })
    } catch {
      onError(t('admin.scoringError'))
    } finally {
      setSaving(false)
    }
  }

  const numField = (label: string, value: number, onChange: (v: string) => void) => (
    <TextField
      type="number"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      size="small"
      slotProps={{ htmlInput: { min: 0, step: 1, 'aria-label': label } }}
      sx={{ width: 150 }}
    />
  )

  return (
    <Box sx={{ mt: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <TuneIcon aria-hidden color="primary" />
        <Typography variant="h5" component="h2">
          {t('admin.scoringTitle')}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('admin.scoringDescription')}
      </Typography>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('admin.scoringBaseTitle')}
      </Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mb: 1.5 }}>
        {numField(t('admin.scoringExact'), cfg.exact, (v) => setBase('exact', v))}
        {numField(t('admin.scoringOutcome'), cfg.outcome, (v) => setBase('outcome', v))}
        {numField(t('admin.scoringGoalDiffBonus'), cfg.goalDiffBonus, (v) =>
          setBase('goalDiffBonus', v),
        )}
      </Stack>
      <FormControlLabel
        control={
          <Switch
            checked={cfg.goalDiffOnlyOnCorrectOutcome}
            disabled={disabled}
            onChange={(e) =>
              setCfg((c) => ({ ...c, goalDiffOnlyOnCorrectOutcome: e.target.checked }))
            }
          />
        }
        label={t('admin.scoringGoalDiffOnly')}
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {t('admin.scoringRoundTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('admin.scoringRoundDescription')}
      </Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
        {SCORING_STAGES.map(({ stage, labelKey }) => (
          <Box key={stage}>
            {numField(t(labelKey), cfg.roundBonus[stage] ?? 0, (v) => setBonus(stage, v))}
          </Box>
        ))}
      </Stack>

      <Button
        variant="contained"
        color="primary"
        onClick={() => void handleSave()}
        disabled={disabled}
      >
        {t('admin.scoringSave')}
      </Button>
      {frozen && (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 1 }}>
          <LockIcon fontSize="inherit" color="action" aria-hidden />
          <Typography variant="caption" color="text.secondary">
            {t('admin.scoringFrozen')}
          </Typography>
        </Stack>
      )}
    </Box>
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
    const removedUid = toRemove.uid
    setRemovingUid(removedUid)
    try {
      // ORDER MATTERS: the orphan-cleanup rule in firestore.rules only allows deleting a
      // prediction once its author has NO member doc, so the membership goes first.
      await deleteDoc(groupMemberDoc(gid, removedUid))
      setToRemove(null)
      // Best-effort cleanup of the ex-member's predictions: blind-delete `{uid}_{matchId}`
      // for every global match id — deleting a nonexistent doc is a permitted no-op under
      // the rules, so no prediction reads are needed. The leaderboard doc is left alone
      // (ingestion-only, two-writers rule); the UI already ignores non-roster entries.
      try {
        const matches = await getDocs(matchesCol)
        const results = await Promise.allSettled(
          matches.docs.map((m) => deleteDoc(groupPredictionDoc(gid, removedUid, m.id))),
        )
        if (results.some((r) => r.status === 'rejected')) {
          setSnack(t('admin.removeCleanupError'))
        }
      } catch {
        // The member removal itself succeeded — surface only the cleanup failure.
        setSnack(t('admin.removeCleanupError'))
      }
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

      <ScoringSection gid={gid} group={group ?? null} frozen={frozen} onError={setSnack} />

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
