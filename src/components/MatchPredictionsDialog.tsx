/**
 * MatchPredictionsDialog — see everyone's predictions for a match, revealed at kickoff (ticket 013).
 *
 * Opened from a match row. Behaviour depends on whether the match has KICKED OFF (the
 * caller computes this from server time vs `match.kickoff`):
 *   - Upcoming: shows a muted "Predictions reveal at kickoff" message and does NOT query
 *     other members' predictions (the rules would deny it before kickoff).
 *   - Kicked off: lists every member's predicted scoreline; if the match is FINISHED it
 *     also shows the points each prediction earned (from the ingestion-written `points`).
 *
 * Each prediction's `uid` is mapped to a display name/avatar via the group roster (member
 * docs + the owner fields). The current user's row is highlighted. All colors come from
 * the theme — no hard-coded palette values.
 */
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import LockClockIcon from '@mui/icons-material/LockClock'
import { useTranslation } from 'react-i18next'
import { useMatchPredictions } from '../hooks/useMatchPredictions'
import { useGroupRoster } from '../hooks/useGroupRoster'
import { LoadingState, ErrorState, EmptyState } from './states'
import { useAuth } from '../auth/useAuth'
import type { Match } from '../shared/types'

export interface MatchPredictionsDialogProps {
  gid: string
  match: Match
  /** True once `match.kickoff <= now` (server-corrected); gates the query. */
  kickedOff: boolean
  open: boolean
  onClose: () => void
}

/** First letter of a name for the avatar fallback. */
function initial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed[0].toUpperCase() : '?'
}

export function MatchPredictionsDialog({
  gid,
  match,
  kickedOff,
  open,
  onClose,
}: MatchPredictionsDialogProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { roster } = useGroupRoster(gid)
  // Only query once kicked off AND the dialog is open (avoids a needless listener).
  const { predictions, loading, error } = useMatchPredictions(gid, match.matchId, open && kickedOff)

  const finished = match.status === 'FINISHED'

  const nameFor = (uid: string) => roster.find((r) => r.uid === uid)
  const titleId = `predictions-${match.matchId}`

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby={titleId}>
      <DialogTitle id={titleId} sx={{ pr: 6 }}>
        {t('predictions.dialogTitle')}
        <Typography variant="body2" color="text.secondary">
          {t('predictions.matchVs', {
            home: match.homeTeam.shortName,
            away: match.awayTeam.shortName,
          })}
        </Typography>
        <IconButton
          aria-label={t('states.close')}
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!kickedOff ? (
          <Stack spacing={1.5} sx={{ py: 3, textAlign: 'center', alignItems: 'center' }}>
            <LockClockIcon fontSize="large" color="disabled" />
            <Typography variant="body1" color="text.secondary">
              {t('predictions.revealAtKickoff')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('predictions.revealDescription')}
            </Typography>
          </Stack>
        ) : loading ? (
          <LoadingState rows={3} label={t('predictions.loadingList')} />
        ) : error ? (
          <ErrorState
            title={t('predictions.listErrorTitle')}
            description={t('predictions.listErrorDescription')}
          />
        ) : predictions.length === 0 ? (
          <EmptyState
            title={t('predictions.noneTitle')}
            description={t('predictions.noneDescription')}
          />
        ) : (
          <List disablePadding aria-label={t('predictions.memberPredictions')}>
            {predictions.map((p) => {
              const member = nameFor(p.uid)
              const displayName = member?.displayName ?? t('predictions.unknownMember')
              const isCurrentUser = user?.uid === p.uid
              return (
                <ListItem
                  key={p.uid}
                  divider
                  aria-current={isCurrentUser ? 'true' : undefined}
                  sx={{
                    gap: 1,
                    borderRadius: 2,
                    bgcolor: isCurrentUser ? 'action.selected' : 'transparent',
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 'auto' }}>
                    <Avatar src={member?.photoURL ?? undefined} alt="">
                      {initial(displayName)}
                    </Avatar>
                  </ListItemAvatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body1"
                      noWrap
                      sx={{ fontWeight: isCurrentUser ? 700 : 500 }}
                    >
                      {displayName}
                      {isCurrentUser && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="primary"
                          sx={{ ml: 1 }}
                        >
                          {t('common.you')}
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                    aria-label={t('predictions.predicted', {
                      home: p.homeGoals,
                      away: p.awayGoals,
                    })}
                  >
                    {p.homeGoals} – {p.awayGoals}
                  </Typography>
                  {finished && p.points !== undefined && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t('predictions.pts', { count: p.points })}
                      aria-label={t('predictions.earnedPoints', { count: p.points })}
                    />
                  )}
                </ListItem>
              )
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default MatchPredictionsDialog
