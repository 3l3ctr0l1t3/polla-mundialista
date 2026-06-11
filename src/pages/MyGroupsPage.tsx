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
import AddIcon from '@mui/icons-material/Add'
import LinkIcon from '@mui/icons-material/Link'
import GroupsIcon from '@mui/icons-material/Groups'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import LogoutIcon from '@mui/icons-material/Logout'
import ShieldIcon from '@mui/icons-material/Shield'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signOutUser } from '../firebase/auth'
import { useAuth } from '../auth/useAuth'
import { useMyGroups, type JoinedGroup } from '../hooks/useMyGroups'
import { LoadingState, EmptyState, ErrorState } from '../components/states'
import { JoinGroupDialog } from '../components/JoinGroupDialog'
import type { Group } from '../shared/types'

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
  const { t } = useTranslation()
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
              {t('groups.awaitingApproval')}
            </Typography>
          </Box>
          <Button
            size="small"
            component={RouterLink}
            to={`/join/${entry.group.groupId}`}
            aria-label={t('groups.viewJoinStatus', { name: entry.group.name })}
          >
            {t('common.view')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function MyGroupsPage() {
  const { t } = useTranslation()
  const { owned, approved, pending, loading, error } = useMyGroups()
  const { isSuperAdmin } = useAuth()
  const [joinOpen, setJoinOpen] = useState(false)

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
            {t('groups.title')}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {isSuperAdmin && (
            <Button
              size="small"
              color="primary"
              startIcon={<ShieldIcon />}
              component={RouterLink}
              to="/superadmin"
            >
              {t('groups.superadmin')}
            </Button>
          )}
          <Button
            size="small"
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={() => void signOutUser()}
          >
            {t('common.signOut')}
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/groups/new">
          {t('groups.createGroup')}
        </Button>
        <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => setJoinOpen(true)}>
          {t('groups.joinViaLink')}
        </Button>
      </Stack>

      {loading ? (
        <LoadingState rows={3} label={t('groups.loading')} />
      ) : error ? (
        <ErrorState title={t('groups.errorTitle')} description={error.message} />
      ) : !hasAny ? (
        <EmptyState
          icon={<GroupsIcon fontSize="inherit" />}
          title={t('groups.emptyTitle')}
          description={t('groups.emptyDescription')}
        />
      ) : (
        <Stack spacing={3}>
          {owned.length > 0 && (
            <Box component="section" aria-label={t('groups.ownedSection')}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                {t('groups.ownedLabel')}
              </Typography>
              <Stack spacing={1.5}>
                {owned.map((g) => (
                  <GroupCard key={g.groupId} group={g} badge={t('groups.ownerBadge')} />
                ))}
              </Stack>
            </Box>
          )}

          {approved.length > 0 && (
            <Box component="section" aria-label={t('groups.joinedSection')}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                {t('groups.joinedLabel')}
              </Typography>
              <Stack spacing={1.5}>
                {approved.map((j) => (
                  <GroupCard key={j.group.groupId} group={j.group} />
                ))}
              </Stack>
            </Box>
          )}

          {pending.length > 0 && (
            <Box component="section" aria-label={t('groups.pendingSection')}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                {t('groups.pendingSection')}
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

      <JoinGroupDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
    </Box>
  )
}

export default MyGroupsPage
