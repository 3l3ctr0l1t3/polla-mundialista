/**
 * PredictionCard — an upcoming fixture with the participant's scoreline entry embedded.
 *
 * Shares MatchCard's visual language by reusing the presentational `MatchTeams` header
 * (team crests/flags, names, group/stage · date caption, and a live countdown chip in the
 * trailing slot). Below the header sits the `PredictionInput` score steppers, which write
 * only the user's own per-group prediction (pre-kickoff) — never points (two-writers rule).
 *
 * Behaviour mirrors the previous Predictions page exactly: the inputs lock at/after kickoff
 * using the server-corrected clock, and a rules-rejected late write surfaces a snackbar from
 * `PredictionInput`. All colors/shape come from the MUI theme — no hard-coded values.
 */
import dayjs from 'dayjs'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { Match, Prediction } from '../shared/types'
import { isTbdTeam } from '../hooks/matchGrouping'
import { MatchTeams, TBD_LABEL } from './MatchTeams'
import { CountdownToKickoff } from './CountdownToKickoff'
import { PredictionInput } from './PredictionInput'

export interface PredictionCardProps {
  /** The group this prediction belongs to (predictions are per-group). */
  gid: string
  match: Match
  /** The user's existing saved prediction for this match, if any (prefills the steppers). */
  existing?: Prediction
  /** Server-corrected current time in ms (drives the countdown + kickoff lock). */
  now: () => number
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

export function PredictionCard({ gid, match, existing, now }: PredictionCardProps) {
  const { homeTeam, awayTeam, kickoff } = match
  const kickoffLocal = dayjs(kickoff.toDate())

  return (
    <Card
      aria-label={`${isTbdTeam(homeTeam) ? TBD_LABEL : homeTeam.name} versus ${isTbdTeam(awayTeam) ? TBD_LABEL : awayTeam.name}`}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 2 } }}>
        <MatchTeams
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          center={
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: 'nowrap' }}
              aria-label={`Kickoff ${kickoffLocal.format('MMM D, HH:mm')}`}
            >
              {kickoffLocal.format('HH:mm')}
            </Typography>
          }
          caption={`${match.group ? `Group ${match.group}` : stageLabel(match)} · ${kickoffLocal.format('MMM D')}`}
          trailing={<CountdownToKickoff kickoffMs={kickoff.toMillis()} now={now} />}
        />

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ pt: 0.5 }}>
          <PredictionInput gid={gid} match={match} existing={existing} now={now} />
        </Box>
      </CardContent>
    </Card>
  )
}

export default PredictionCard
