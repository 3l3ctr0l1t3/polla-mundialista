/**
 * FixtureCard — the ONE unified fixture + prediction card (ticket 018).
 *
 * Merges the old read-only `MatchCard` (status/score + reveal dialog) and the old
 * `PredictionCard`/`PredictionInput` (score steppers + save) into a single surface on the
 * Fixtures page. Layout is a single centered line — home name · home flag · prediction/result ·
 * away flag · away name (flags inboard next to the score, names on the outside) — with the
 * caption + status above it.
 *
 * UPCOMING (not final, not in-play, real teams): renders the two centered goal steppers +
 * Save/Update button driven by `useSavePrediction` (the ONE write path — never points), with
 * the kickoff lock + countdown chip.
 *
 * LIVE/FINISHED: shows the result score, the viewer's OWN prediction subtly, and a button
 * that opens `MatchPredictionsDialog` to reveal everyone's picks (rules-gated reveal-at-kickoff).
 *
 * All copy is localized via `t()`; all colors/shape come from the MUI theme.
 */
import { useState } from 'react'
import dayjs from 'dayjs'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import GroupsIcon from '@mui/icons-material/Groups'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Match, Team, Prediction } from '../shared/types'
import { isTbdTeam } from '../hooks/matchGrouping'
import { useTbdLabel } from './useTbdLabel'
import { useSavePrediction, toGoals } from '../hooks/useSavePrediction'
import { MatchPredictionsDialog } from './MatchPredictionsDialog'
import { CountdownToKickoff } from './CountdownToKickoff'

const FINAL = new Set(['FINISHED', 'CANCELLED', 'POSTPONED', 'SUSPENDED'])

export interface FixtureCardProps {
  /** The group this prediction belongs to (predictions are per-group, ticket 012). */
  gid: string
  match: Match
  /** The viewer's existing saved prediction for this match, if any (prefills the steppers). */
  existing?: Prediction
  /** Server-corrected current time in ms (drives the countdown, kickoff lock + reveal gate). */
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

/** A team name — outer element on its side of the line; shrinks/ellipsizes to fit. */
function TeamName({
  team,
  tbdLabel,
  align,
}: {
  team: Team
  tbdLabel: string
  align: 'left' | 'right'
}) {
  const tbd = isTbdTeam(team)
  const name = tbd ? tbdLabel : team.name
  return (
    <Typography
      variant="body2"
      noWrap
      title={name}
      sx={{
        flex: 1,
        minWidth: 0,
        textAlign: align,
        fontWeight: 600,
        color: tbd ? 'text.secondary' : 'text.primary',
      }}
    >
      {name}
    </Typography>
  )
}

/** A team flag — sits inboard, next to the score/steppers. */
function TeamFlag({ team, tbdLabel }: { team: Team; tbdLabel: string }) {
  const tbd = isTbdTeam(team)
  return (
    <Avatar
      src={!tbd && team.crest ? team.crest : undefined}
      alt={tbd ? tbdLabel : team.name}
      sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: 'action.hover' }}
      slotProps={{ img: { loading: 'lazy' } }}
    >
      <SportsSoccerIcon fontSize="small" />
    </Avatar>
  )
}

/** Compact centered goal stepper for the editable (upcoming) state. */
function Stepper({
  value,
  disabled,
  onChange,
  ariaLabel,
  increaseLabel,
  decreaseLabel,
}: {
  value: number
  disabled: boolean
  onChange: (n: number) => void
  ariaLabel: string
  increaseLabel: string
  decreaseLabel: string
}) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'center' }}>
      <IconButton
        size="small"
        disabled={disabled || value <= 0}
        aria-label={decreaseLabel}
        onClick={() => onChange(toGoals(value - 1))}
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
          color: disabled ? 'text.disabled' : 'text.primary',
        }}
      >
        {value}
      </Typography>
      <IconButton
        size="small"
        disabled={disabled}
        aria-label={increaseLabel}
        onClick={() => onChange(toGoals(value + 1))}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}

export function FixtureCard({ gid, match, existing, now }: FixtureCardProps) {
  const { t } = useTranslation()
  const tbdLabel = useTbdLabel()
  const { homeTeam, awayTeam, score, status, kickoff } = match
  const kickoffLocal = dayjs(kickoff.toDate())

  const played = score.home !== null && score.away !== null
  const showResult = played || status === 'IN_PLAY' || status === 'PAUSED'
  const editable =
    !FINAL.has(status) && status !== 'IN_PLAY' && status !== 'PAUSED' && !isTbdTeam(homeTeam)

  const {
    homeGoals,
    awayGoals,
    setHomeGoals,
    setAwayGoals,
    locked,
    saving,
    snack,
    dismissSnack,
    save,
  } = useSavePrediction(gid, match, existing, now)

  const [dialogOpen, setDialogOpen] = useState(false)
  // Server-corrected reveal gate; the Firestore rule is the real authority.
  const kickedOff = now() >= kickoff.toMillis()

  const homeLabel = match.homeTeam.shortName || match.homeTeam.tla || t('predictions.home')
  const awayLabel = match.awayTeam.shortName || match.awayTeam.tla || t('predictions.away')

  const caption = t('match.captionWithDate', {
    stage: match.group ? t('match.groupLabel', { letter: match.group }) : stageLabel(match, t),
    date: kickoffLocal.format('MMM D, HH:mm'),
  })

  const statusChip =
    status === 'IN_PLAY' || status === 'PAUSED' ? (
      <Chip size="small" label={t('match.statusLive')} color="error" variant="outlined" />
    ) : status === 'FINISHED' ? (
      <Chip size="small" label={t('match.statusFinished')} color="success" variant="outlined" />
    ) : (
      <Chip size="small" label={t('match.statusScheduled')} variant="outlined" />
    )

  const inputsDisabled = locked || saving

  return (
    <Card
      aria-label={t('match.versus', {
        home: isTbdTeam(homeTeam) ? tbdLabel : homeTeam.name,
        away: isTbdTeam(awayTeam) ? tbdLabel : awayTeam.name,
      })}
    >
      <CardContent sx={{ py: 2, textAlign: 'center', '&:last-child': { pb: 2 } }}>
        <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
          {/* Top row: caption left, countdown (upcoming) / status (live·finished) top-right. */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
          >
            <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
              {caption}
            </Typography>
            {editable ? (
              <CountdownToKickoff kickoffMs={kickoff.toMillis()} now={now} />
            ) : (
              statusChip
            )}
          </Stack>

          {/* One line: home name · home flag · prediction/result · away flag · away name. */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <TeamName team={homeTeam} tbdLabel={tbdLabel} align="right" />
            <TeamFlag team={homeTeam} tbdLabel={tbdLabel} />

            <Box sx={{ flexShrink: 0, px: 0.5 }}>
              {editable ? (
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Stepper
                    value={homeGoals}
                    disabled={inputsDisabled}
                    onChange={setHomeGoals}
                    ariaLabel={t('predictions.teamGoals', { team: homeLabel })}
                    increaseLabel={t('predictions.increaseGoals', { team: homeLabel })}
                    decreaseLabel={t('predictions.decreaseGoals', { team: homeLabel })}
                  />
                  <Typography aria-hidden sx={{ fontWeight: 700 }}>
                    –
                  </Typography>
                  <Stepper
                    value={awayGoals}
                    disabled={inputsDisabled}
                    onChange={setAwayGoals}
                    ariaLabel={t('predictions.teamGoals', { team: awayLabel })}
                    increaseLabel={t('predictions.increaseGoals', { team: awayLabel })}
                    decreaseLabel={t('predictions.decreaseGoals', { team: awayLabel })}
                  />
                </Stack>
              ) : showResult ? (
                <Typography
                  component="p"
                  aria-label={t('match.score', { home: score.home, away: score.away })}
                  sx={{
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: '1.6rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {score.home}&nbsp;–&nbsp;{score.away}
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
              )}
            </Box>

            <TeamFlag team={awayTeam} tbdLabel={tbdLabel} />
            <TeamName team={awayTeam} tbdLabel={tbdLabel} align="left" />
          </Stack>

          {/* Upcoming: Save/Update (the "Locks in…" countdown lives top-right). */}
          {editable && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              disabled={inputsDisabled}
              onClick={() => void save()}
            >
              {existing ? t('predictions.update') : t('predictions.save')}
            </Button>
          )}

          {/* Live/finished: surface the viewer's own prediction subtly. */}
          {showResult && existing && (
            <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.3 }}>
              {t('predictions.yourPrediction', {
                home: existing.homeGoals,
                away: existing.awayGoals,
              })}
            </Typography>
          )}
        </Stack>
      </CardContent>

      {/* Live/finished: reveal everyone's picks (rules-gated reveal-at-kickoff). */}
      {showResult && (
        <>
          <CardActions sx={{ pt: 0, px: 2, pb: 1.5, justifyContent: 'center' }}>
            <Button size="small" startIcon={<GroupsIcon />} onClick={() => setDialogOpen(true)}>
              {t('predictions.openDialog')}
            </Button>
          </CardActions>
          <MatchPredictionsDialog
            gid={gid}
            match={match}
            kickedOff={kickedOff}
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
          />
        </>
      )}

      <Snackbar
        open={snack !== null}
        autoHideDuration={4000}
        onClose={dismissSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={dismissSnack} variant="filled">
            {snack.message}
          </Alert>
        ) : (
          <Box />
        )}
      </Snackbar>
    </Card>
  )
}

export default FixtureCard
