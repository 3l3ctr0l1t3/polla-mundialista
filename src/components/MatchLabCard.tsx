/**
 * MatchLabCard — EXPERIMENTAL unified fixture+prediction card (superadmin Canvas only).
 *
 * A design sandbox for folding the prediction steppers directly into the fixture card so
 * the separate Predictions page becomes unnecessary. PRESENTATIONAL ONLY: goal state is
 * local useState and nothing is written to Firestore.
 *
 * Layout (centered): caption + status on top, then each team as a centered column with the
 * NAME above its FLAG, then the prediction steppers (upcoming) or the result score
 * (live/finished) beneath — so the flags sit between the names and the prediction/results.
 */
import { useState } from 'react'
import dayjs from 'dayjs'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import type { Match, Team } from '../shared/types'
import { isTbdTeam } from '../hooks/matchGrouping'

const TBD_LABEL = 'TBD'
const FINAL = new Set(['FINISHED', 'CANCELLED', 'POSTPONED', 'SUSPENDED'])

export interface MatchLabCardProps {
  match: Match
  /** The viewer's saved prediction; shown subtly under the score on live/finished cards. */
  prediction?: { home: number; away: number }
}

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

/** A team as a centered column: name on top, flag below. */
function TeamColumn({ team }: { team: Team }) {
  const tbd = isTbdTeam(team)
  return (
    <Stack spacing={0.75} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
      <Typography
        variant="body2"
        noWrap
        title={tbd ? TBD_LABEL : team.name}
        sx={{ fontWeight: 600, maxWidth: '100%', color: tbd ? 'text.secondary' : 'text.primary' }}
      >
        {tbd ? TBD_LABEL : team.name}
      </Typography>
      <Avatar
        src={!tbd && team.crest ? team.crest : undefined}
        alt=""
        aria-hidden
        sx={{ width: 44, height: 44, bgcolor: 'action.hover' }}
        slotProps={{ img: { loading: 'lazy' } }}
      >
        <SportsSoccerIcon />
      </Avatar>
    </Stack>
  )
}

/** Compact presentational goal stepper (local only). */
function Stepper({
  value,
  onChange,
  ariaLabel,
}: {
  value: number
  onChange: (n: number) => void
  ariaLabel: string
}) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'center' }}>
      <IconButton
        size="small"
        disabled={value <= 0}
        aria-label={`Decrease ${ariaLabel}`}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography
        component="span"
        aria-label={ariaLabel}
        sx={{
          minWidth: 28,
          textAlign: 'center',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '1.5rem',
          lineHeight: 1,
        }}
      >
        {value}
      </Typography>
      <IconButton
        size="small"
        aria-label={`Increase ${ariaLabel}`}
        onClick={() => onChange(value + 1)}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}

export function MatchLabCard({ match, prediction }: MatchLabCardProps) {
  const { homeTeam, awayTeam, score, status, kickoff } = match
  const kickoffLocal = dayjs(kickoff.toDate())
  const played = score.home !== null && score.away !== null
  const showResult = played || status === 'IN_PLAY'
  const editable =
    !FINAL.has(status) && status !== 'IN_PLAY' && status !== 'PAUSED' && !isTbdTeam(homeTeam)

  const [home, setHome] = useState(prediction?.home ?? 0)
  const [away, setAway] = useState(prediction?.away ?? 0)

  const caption = `${match.group ? `Group ${match.group}` : stageLabel(match)} · ${kickoffLocal.format('MMM D, HH:mm')}`
  const statusChip =
    status === 'IN_PLAY' || status === 'PAUSED' ? (
      <Chip size="small" label="Live" color="error" variant="outlined" />
    ) : status === 'FINISHED' ? (
      <Chip size="small" label="Finished" color="success" variant="outlined" />
    ) : (
      <Chip size="small" label="Scheduled" variant="outlined" />
    )

  return (
    <Card
      aria-label={`${isTbdTeam(homeTeam) ? TBD_LABEL : homeTeam.name} versus ${isTbdTeam(awayTeam) ? TBD_LABEL : awayTeam.name}`}
    >
      <CardContent sx={{ py: 2, textAlign: 'center', '&:last-child': { pb: 2 } }}>
        <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {caption}
            </Typography>
            {statusChip}
          </Stack>

          {/* Names + flags: two centered columns (name above flag). */}
          <Stack
            direction="row"
            spacing={2}
            sx={{ width: '100%', maxWidth: 340, justifyContent: 'center' }}
          >
            <TeamColumn team={homeTeam} />
            <TeamColumn team={awayTeam} />
          </Stack>

          {/* Prediction / result / kickoff, centered beneath the flags. */}
          {editable ? (
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center', justifyContent: 'center' }}
            >
              <Stepper value={home} onChange={setHome} ariaLabel="home goals" />
              <Typography aria-hidden sx={{ fontWeight: 700 }}>
                –
              </Typography>
              <Stepper value={away} onChange={setAway} ariaLabel="away goals" />
            </Stack>
          ) : showResult ? (
            <Typography
              component="p"
              aria-label={`Score ${score.home} to ${score.away}`}
              sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: '1.75rem' }}
            >
              {score.home}&nbsp;–&nbsp;{score.away}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {kickoffLocal.format('ddd MMM D · HH:mm')}
            </Typography>
          )}

          {/* Live/finished: surface the viewer's prediction subtly. */}
          {showResult && prediction && (
            <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.3 }}>
              Your prediction{' '}
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {prediction.home}–{prediction.away}
              </Box>
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

export default MatchLabCard
