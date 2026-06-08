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
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Match, Prediction } from '../shared/types'
import { isTbdTeam } from '../hooks/matchGrouping'
import { MatchTeams } from './MatchTeams'
import { useTbdLabel } from './useTbdLabel'
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

export function PredictionCard({ gid, match, existing, now }: PredictionCardProps) {
  const { t } = useTranslation()
  const tbdLabel = useTbdLabel()
  const { homeTeam, awayTeam, kickoff } = match
  const kickoffLocal = dayjs(kickoff.toDate())

  return (
    <Card
      aria-label={t('match.versus', {
        home: isTbdTeam(homeTeam) ? tbdLabel : homeTeam.name,
        away: isTbdTeam(awayTeam) ? tbdLabel : awayTeam.name,
      })}
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
              aria-label={t('match.kickoff', { when: kickoffLocal.format('MMM D, HH:mm') })}
            >
              {kickoffLocal.format('HH:mm')}
            </Typography>
          }
          caption={t('match.captionWithDate', {
            stage: match.group
              ? t('match.groupLabel', { letter: match.group })
              : stageLabel(match, t),
            date: kickoffLocal.format('MMM D'),
          })}
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
