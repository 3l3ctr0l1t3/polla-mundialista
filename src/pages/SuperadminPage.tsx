/**
 * SuperadminPage (`/superadmin`) — the app owner's god-view over every group (ticket 014).
 *
 * Lists ALL groups (`useAllGroups`) with owner, created date, invite code; expanding a
 * group lazily loads that group's `members` + `leaderboard` (per-group collection reads,
 * authorized for a superadmin by the `isSuperAdmin()` rule — NOT collection-group queries)
 * and shows participants (the implicit owner + each member with status/role) and the live
 * leaderboard. Read-only oversight: nothing here writes.
 *
 * Guarded both at the route (App.tsx) and here: a non-superadmin is redirected to `/`.
 * Provides Loading / Empty / Error states. The `firestore.rules` remain the real gate.
 */
import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { Navigate, Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Divider from '@mui/material/Divider'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ShieldIcon from '@mui/icons-material/Shield'
import GroupsIcon from '@mui/icons-material/Groups'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useAuth } from '../auth/useAuth'
import { useAllGroups } from '../hooks/useAllGroups'
import { groupMembersCol, groupLeaderboardCol } from '../firebase/db'
import { LeaderboardRow } from '../components/LeaderboardRow'
import { LoadingState, EmptyState, ErrorState } from '../components/states'
import type { Group, Member, LeaderboardEntry, MemberStatus } from '../shared/types'

/** Map a member status to an MD3 chip color (tokens via the palette, never hard-coded). */
function statusColor(status: MemberStatus): 'success' | 'warning' | 'default' {
  if (status === 'approved') return 'success'
  if (status === 'pending') return 'warning'
  return 'default'
}

/** Best-effort short date from a Firestore Timestamp; '' when unavailable. */
function formatCreated(group: Group): string {
  const ts = group.createdAt as unknown as { toDate?: () => Date } | null | undefined
  if (!ts || typeof ts.toDate !== 'function') return ''
  try {
    return ts.toDate().toLocaleDateString()
  } catch {
    return ''
  }
}

function initial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed[0].toUpperCase() : '?'
}

/**
 * Lazily-mounted detail for one group: live members + leaderboard listeners that only
 * attach when the parent accordion is expanded (this subtree is unmounted when collapsed).
 */
function GroupParticipants({ group }: { group: Group }) {
  const { t } = useTranslation()
  const [members, setMembers] = useState<Member[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    let membersLoaded = false

    const unsubMembers = onSnapshot(
      groupMembersCol(group.groupId),
      (snap) => {
        setMembers(snap.docs.map((d) => d.data()))
        membersLoaded = true
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )

    const unsubLeaderboard = onSnapshot(
      groupLeaderboardCol(group.groupId),
      (snap) => {
        const rows = snap.docs.map((d) => d.data())
        rows.sort((a, b) => a.rank - b.rank || b.totalPoints - a.totalPoints)
        setLeaderboard(rows)
        // The leaderboard may resolve first; don't unset members' loading.
        if (membersLoaded) setLoading(false)
      },
      () => {
        // Leaderboard is optional oversight detail; a failure here doesn't block members.
      },
    )

    return () => {
      unsubMembers()
      unsubLeaderboard()
    }
  }, [group.groupId])

  if (loading) {
    return (
      <LoadingState rows={2} label={t('superadmin.loadingParticipants', { name: group.name })} />
    )
  }
  if (error) {
    return <ErrorState title={t('superadmin.participantsErrorTitle')} description={error.message} />
  }

  return (
    <Stack spacing={2}>
      <Box component="section" aria-label={t('superadmin.participants')}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {t('superadmin.participants')}
        </Typography>
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <List disablePadding>
            {/* The implicit owner has no member doc — render from the group fields. */}
            <ListItem>
              <ListItemAvatar sx={{ minWidth: 'auto', mr: 1.5 }}>
                <Avatar src={group.ownerPhotoURL ?? undefined} alt="">
                  {initial(group.ownerName)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={group.ownerName}
                secondary={t('superadmin.owner')}
                slotProps={{ primary: { noWrap: true } }}
              />
              <Chip size="small" color="primary" label={t('superadmin.owner')} />
            </ListItem>

            {members.map((m) => (
              <ListItem key={m.uid} divider>
                <ListItemAvatar sx={{ minWidth: 'auto', mr: 1.5 }}>
                  <Avatar src={m.photoURL ?? undefined} alt="">
                    {initial(m.displayName)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={m.displayName}
                  secondary={m.email}
                  slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                />
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {m.role === 'admin' && (
                    <Chip size="small" variant="outlined" label={t('superadmin.admin')} />
                  )}
                  <Chip size="small" color={statusColor(m.status)} label={m.status} />
                </Stack>
              </ListItem>
            ))}
          </List>
        </Paper>
        {members.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('superadmin.ownerOnly')}
          </Typography>
        )}
      </Box>

      <Box component="section" aria-label={t('superadmin.leaderboard')}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {t('superadmin.leaderboard')}
        </Typography>
        {leaderboard.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('superadmin.noGradedPoints')}
          </Typography>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <List
              disablePadding
              aria-label={t('superadmin.groupLeaderboardAria', { name: group.name })}
            >
              {leaderboard.map((entry) => (
                <LeaderboardRow key={entry.uid} entry={entry} />
              ))}
            </List>
          </Paper>
        )}
      </Box>
    </Stack>
  )
}

function GroupAccordion({ group }: { group: Group }) {
  const [expanded, setExpanded] = useState(false)
  const created = formatCreated(group)

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      variant="outlined"
      disableGutters
      sx={{ borderRadius: 3, '&:before': { display: 'none' }, overflow: 'hidden' }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`group-${group.groupId}-content`}
        id={`group-${group.groupId}-header`}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0, flexGrow: 1 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }} aria-hidden>
            {initial(group.name)}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" noWrap>
              {group.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              Owner: {group.ownerName}
              {created && ` · Created ${created}`}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            label={`Code: ${group.inviteCode}`}
            sx={{ mr: 1, display: { xs: 'none', sm: 'inline-flex' } }}
          />
        </Stack>
      </AccordionSummary>
      <Divider />
      <AccordionDetails sx={{ pt: 2 }}>
        {expanded && <GroupParticipants group={group} />}
      </AccordionDetails>
    </Accordion>
  )
}

export function SuperadminPage() {
  const { isSuperAdmin } = useAuth()
  const { groups, loading, error } = useAllGroups()
  const { t } = useTranslation()

  // Defense in depth: even if the route guard is bypassed, render nothing useful.
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto', width: '100%' }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 1 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShieldIcon aria-hidden color="primary" />
          <Typography variant="h5" component="h1">
            {t('superadmin.title')}
          </Typography>
        </Stack>
        <Button size="small" startIcon={<ArrowBackIcon />} component={RouterLink} to="/">
          {t('superadmin.myGroups')}
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('superadmin.subtitle')}
      </Typography>

      {loading ? (
        <LoadingState rows={4} label={t('superadmin.loading')} />
      ) : error ? (
        <ErrorState title={t('superadmin.errorTitle')} description={error.message} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<GroupsIcon fontSize="inherit" />}
          title={t('superadmin.emptyTitle')}
          description={t('superadmin.emptyDescription')}
        />
      ) : (
        <Stack spacing={1.5}>
          <Typography variant="overline" color="text.secondary">
            {t('superadmin.groupCount', { count: groups.length })}
          </Typography>
          {groups.map((g) => (
            <GroupAccordion key={g.groupId} group={g} />
          ))}
        </Stack>
      )}
    </Box>
  )
}

export default SuperadminPage
