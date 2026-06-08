/**
 * MatchCard — a single fixture/result row.
 *
 * Renders both teams (crest + name), the kickoff in the viewer's local time
 * (dayjs), a status chip (SCHEDULED/IN_PLAY/FINISHED/…), and the score when the
 * match has been played. Knockout fixtures with undecided teams render as **TBD**
 * placeholders without crashing.
 *
 * Read-only: the browser never writes results (two-writers rule). All colors come
 * from the MUI theme — no hard-coded palette values.
 */
import { useState } from 'react'
import dayjs from 'dayjs'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import GroupsIcon from '@mui/icons-material/Groups'
import type { ChipProps } from '@mui/material/Chip'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Match, MatchStatus } from '../shared/types'
import { useServerTime } from '../hooks/useServerTime'
import { MatchPredictionsDialog } from './MatchPredictionsDialog'
import { MatchTeams } from './MatchTeams'
import { useTeamName } from '../i18n/useTeamName'

export interface MatchCardProps {
  match: Match
  /**
   * When set, renders a "Predictions" action that opens the per-match reveal dialog for
   * this group (ticket 013). Omit on pages with no group context (e.g. global fixtures).
   */
  gid?: string
}

/** Status -> { label, MUI chip color }. Color comes from the theme palette. */
function statusChip(
  status: MatchStatus,
  t: TFunction,
): { label: string; color: ChipProps['color'] } {
  switch (status) {
    case 'IN_PLAY':
    case 'PAUSED':
      return { label: t('match.statusLive'), color: 'error' }
    case 'FINISHED':
      return { label: t('match.statusFinished'), color: 'success' }
    case 'POSTPONED':
      return { label: t('match.statusPostponed'), color: 'warning' }
    case 'SUSPENDED':
      return { label: t('match.statusSuspended'), color: 'warning' }
    case 'CANCELLED':
      return { label: t('match.statusCancelled'), color: 'warning' }
    case 'SCHEDULED':
    case 'TIMED':
    default:
      return { label: t('match.statusScheduled'), color: 'default' }
  }
}

export function MatchCard({ match, gid }: MatchCardProps) {
  const { t } = useTranslation()
  const teamName = useTeamName()
  const { homeTeam, awayTeam, score, status, kickoff } = match
  const chip = statusChip(status, t)
  const played = score.home !== null && score.away !== null
  const kickoffLocal = dayjs(kickoff.toDate())
  const { now } = useServerTime()
  const [predictionsOpen, setPredictionsOpen] = useState(false)
  // Server-corrected reveal gate; the Firestore rule is the real authority.
  const kickedOff = now() >= kickoff.toMillis()

  const center = played ? (
    <Typography
      variant="h6"
      component="p"
      sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
      aria-label={t('match.score', { home: score.home, away: score.away })}
    >
      {score.home} – {score.away}
    </Typography>
  ) : (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ whiteSpace: 'nowrap' }}
      aria-label={t('match.kickoff', { when: kickoffLocal.format('MMM D, HH:mm') })}
    >
      {kickoffLocal.format('HH:mm')}
    </Typography>
  )

  return (
    <Card
      aria-label={t('match.versus', {
        home: teamName(homeTeam),
        away: teamName(awayTeam),
      })}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <MatchTeams
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          center={center}
          caption={t('match.captionWithDate', {
            stage: match.group
              ? t('match.groupLabel', { letter: match.group })
              : stageLabel(match, t),
            date: kickoffLocal.format('MMM D'),
          })}
          trailing={<Chip size="small" label={chip.label} color={chip.color} variant="outlined" />}
        />
      </CardContent>

      {gid && (
        <>
          <CardActions sx={{ pt: 0, px: 2, pb: 1.5, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              startIcon={<GroupsIcon />}
              onClick={() => setPredictionsOpen(true)}
            >
              {t('predictions.openDialog')}
            </Button>
          </CardActions>
          <MatchPredictionsDialog
            gid={gid}
            match={match}
            kickedOff={kickedOff}
            open={predictionsOpen}
            onClose={() => setPredictionsOpen(false)}
          />
        </>
      )}
    </Card>
  )
}

/** Human label for a knockout stage when no group letter is present. */
function stageLabel(match: Match, t: TFunction): string {
  switch (match.stage) {
    case 'LAST_32':
      return t('match.stageRoundOf32')
    case 'LAST_16':
      return t('match.stageRoundOf16')
    case 'QUARTER_FINALS':
      return t('match.stageQuarterFinals')
    case 'SEMI_FINALS':
      return t('match.stageSemiFinals')
    case 'THIRD_PLACE':
      return t('match.stageThirdPlace')
    case 'FINAL':
      return t('match.stageFinal')
    case 'GROUP_STAGE':
    default:
      return t('match.stageGroup')
  }
}

export default MatchCard
