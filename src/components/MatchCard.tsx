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
import type { Match, MatchStatus } from '../shared/types'
import { isTbdTeam } from '../hooks/matchGrouping'
import { useServerTime } from '../hooks/useServerTime'
import { MatchPredictionsDialog } from './MatchPredictionsDialog'
import { MatchTeams, TBD_LABEL } from './MatchTeams'

export interface MatchCardProps {
  match: Match
  /**
   * When set, renders a "Predictions" action that opens the per-match reveal dialog for
   * this group (ticket 013). Omit on pages with no group context (e.g. global fixtures).
   */
  gid?: string
}

/** Status -> { label, MUI chip color }. Color comes from the theme palette. */
function statusChip(status: MatchStatus): { label: string; color: ChipProps['color'] } {
  switch (status) {
    case 'IN_PLAY':
    case 'PAUSED':
      return { label: 'Live', color: 'error' }
    case 'FINISHED':
      return { label: 'Finished', color: 'success' }
    case 'POSTPONED':
    case 'SUSPENDED':
    case 'CANCELLED':
      return { label: status.charAt(0) + status.slice(1).toLowerCase(), color: 'warning' }
    case 'SCHEDULED':
    case 'TIMED':
    default:
      return { label: 'Scheduled', color: 'default' }
  }
}

export function MatchCard({ match, gid }: MatchCardProps) {
  const { homeTeam, awayTeam, score, status, kickoff } = match
  const chip = statusChip(status)
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
      aria-label={`Score ${score.home} to ${score.away}`}
    >
      {score.home} – {score.away}
    </Typography>
  ) : (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ whiteSpace: 'nowrap' }}
      aria-label={`Kickoff ${kickoffLocal.format('MMM D, HH:mm')}`}
    >
      {kickoffLocal.format('HH:mm')}
    </Typography>
  )

  return (
    <Card
      aria-label={`${isTbdTeam(homeTeam) ? TBD_LABEL : homeTeam.name} versus ${isTbdTeam(awayTeam) ? TBD_LABEL : awayTeam.name}`}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <MatchTeams
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          center={center}
          caption={`${match.group ? `Group ${match.group}` : stageLabel(match)} · ${kickoffLocal.format('MMM D')}`}
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
              Predictions
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
function stageLabel(match: Match): string {
  switch (match.stage) {
    case 'LAST_32':
      return 'Round of 32'
    case 'LAST_16':
      return 'Round of 16'
    case 'QUARTER_FINALS':
      return 'Quarter-finals'
    case 'SEMI_FINALS':
      return 'Semi-finals'
    case 'THIRD_PLACE':
      return 'Third place'
    case 'FINAL':
      return 'Final'
    case 'GROUP_STAGE':
    default:
      return 'Group stage'
  }
}

export default MatchCard
