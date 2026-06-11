/**
 * FixtureCard — the ONE unified fixture + prediction card (ticket 018).
 *
 * Merges the old read-only `MatchCard` (status/score + reveal dialog) and the old
 * `PredictionCard`/`PredictionInput` (score steppers + save) into a single surface on the
 * Fixtures page. Layout is a centered row of three columns — home (name above flag) ·
 * prediction/result · away (name above flag) — the team name stacked over its flag at every
 * breakpoint, with the caption + status above it.
 *
 * UPCOMING + EDITABLE (not final, not in-play, real teams, pre-lock): renders the two
 * centered goal steppers + Save/Update button driven by `useSavePrediction` (the ONE write
 * path — never points), with the kickoff lock + countdown chip.
 *
 * UPCOMING + LOCKED (ticket 027): once the mode-aware lock instant passes (lazy: kickoff −
 * 10 min; strict: the tournament window cutoff) the dead steppers/Save are replaced by the
 * viewer's OWN pick read-only (or a localized "no prediction" note) and the SAME "See group
 * predictions" button as the live/finished state — the dialog keeps its rules-gated
 * "reveals at kickoff" placeholder until kickoff. `useBoundaryTick` re-renders the card at
 * the lock + kickoff instants so both swaps happen live, with no page refresh.
 *
 * LIVE: shows the result score, the viewer's OWN prediction subtly, and a button that opens
 * `MatchPredictionsDialog` to reveal everyone's picks (rules-gated reveal-at-kickoff).
 *
 * FINISHED (ticket 032): no button — the WHOLE card is an accessible click target that opens
 * the same dialog, and a bottom-right dot + points pill (canvas option C) shows how the pick
 * did: green `success` = exact, orange `warning` = right outcome only, red `error` = missed.
 * Ingestion-written `points`/`breakdown` are authoritative; otherwise the pill previews with
 * the ONE shared scoring engine (group-config aware). The card renders the SAME three fixed
 * zones (top row · 84px center · 44px footer) in every state so it never changes size.
 *
 * All copy is localized via `t()`; all colors/shape come from the MUI theme.
 */
import { useState, type ReactNode } from 'react'
import dayjs from 'dayjs'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { EyeIcon, EditScoreIcon } from './icons'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Match, Team, Prediction } from '../shared/types'
import { scorePrediction, effectiveScoring } from '../shared/scoring'
import { isTbdTeam } from '../hooks/matchGrouping'
import { useTeamName } from '../i18n/useTeamName'
import { useSavePrediction, toGoals } from '../hooks/useSavePrediction'
import { useBoundaryTick } from '../hooks/useBoundaryTick'
import { useGroup } from '../group/useGroup'
import { useTournamentConfig } from '../hooks/useTournamentConfig'
import { effectiveMode, lockTimeMs } from '../shared/predictionLock'
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

/** A team name — sits ABOVE the flag, centered and wrapping at every breakpoint. */
function TeamName({ team }: { team: Team }) {
  const teamName = useTeamName()
  const tbd = isTbdTeam(team)
  const name = teamName(team)
  return (
    <Typography
      variant="body2"
      title={name}
      sx={{
        width: '100%',
        minWidth: 0,
        textAlign: 'center',
        fontWeight: 600,
        lineHeight: 1.15,
        color: tbd ? 'text.secondary' : 'text.primary',
        // Wrap so the full country name shows on its own line(s), centered above the flag.
        whiteSpace: 'normal',
      }}
    >
      {name}
    </Typography>
  )
}

/** A team flag — sits inboard, next to the score/steppers. */
function TeamFlag({ team }: { team: Team }) {
  const teamName = useTeamName()
  const tbd = isTbdTeam(team)
  return (
    <Avatar
      src={!tbd && team.crest ? team.crest : undefined}
      alt={teamName(team)}
      sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: 'action.hover' }}
      slotProps={{ img: { loading: 'lazy' } }}
    >
      <SportsSoccerIcon fontSize="small" />
    </Avatar>
  )
}

/** Compact centered goal spinner (chevron-up · number · chevron-down) for the editable state. */
function Spinner({
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
    <Stack sx={{ alignItems: 'center', justifyContent: 'center' }}>
      <IconButton
        size="small"
        disabled={disabled}
        aria-label={increaseLabel}
        onClick={() => onChange(toGoals(value + 1))}
      >
        <KeyboardArrowUpIcon fontSize="small" />
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
        disabled={disabled || value <= 0}
        aria-label={decreaseLabel}
        onClick={() => onChange(toGoals(value - 1))}
      >
        <KeyboardArrowDownIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}

/** Best scoring tier the pick hit — drives the pill's single tint (ticket 032). */
type Tier = 'exact' | 'outcome' | 'miss'

const TIER_COLOR: Record<Tier, 'success.main' | 'warning.main' | 'error.main'> = {
  exact: 'success.main',
  outcome: 'warning.main',
  miss: 'error.main',
}

/** A single colored dot (canvas option C). */
function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: color,
        border: 1,
        borderColor: color,
        flexShrink: 0,
      }}
    />
  )
}

/**
 * Dot + points pill, tinted by the best tier (canvas option C, ticket 032). Pinned to the
 * card's bottom-right corner over the (empty) finished footer. Display-only: pointer events
 * are off so it never swallows the finished card's click affordance.
 */
function PointsPill({ points, tier }: { points: number; tier: Tier }) {
  const { t } = useTranslation()
  const color = TIER_COLOR[tier]
  return (
    <Stack
      direction="row"
      spacing={0.75}
      data-testid="fixture-card-points-pill"
      data-tier={tier}
      sx={{
        position: 'absolute',
        right: 10,
        bottom: 8,
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: 999,
        border: 1,
        borderColor: color,
        pointerEvents: 'none',
      }}
    >
      <Dot color={color} size={8} />
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}
      >
        {t('predictions.pts', { count: points })}
      </Typography>
    </Stack>
  )
}

export function FixtureCard({ gid, match, existing, now }: FixtureCardProps) {
  const { t } = useTranslation()
  const teamName = useTeamName()
  const { group } = useGroup()
  const { cutoffs } = useTournamentConfig()
  const { homeTeam, awayTeam, score, status, kickoff } = match
  const kickoffLocal = dayjs(kickoff.toDate())

  // Mode-aware lock: the countdown + `useSavePrediction` target the SAME instant the rules do.
  const mode = effectiveMode(group ?? {})
  const lockMs = lockTimeMs(match, mode, cutoffs)

  const played = score.home !== null && score.away !== null
  const showResult = played || status === 'IN_PLAY' || status === 'PAUSED'
  const upcoming =
    !FINAL.has(status) && status !== 'IN_PLAY' && status !== 'PAUSED' && !isTbdTeam(homeTeam)
  // Ticket 032: grading is surfaced only at FINISHED; in-play/paused stays "live".
  const finished = status === 'FINISHED'
  const live = showResult && !finished

  const {
    homeGoals,
    awayGoals,
    setHomeGoals,
    setAwayGoals,
    locked,
    dirty,
    saving,
    snack,
    dismissSnack,
    save,
  } = useSavePrediction(gid, match, existing, now, mode, cutoffs)

  // The card's fourth state (ticket 027): locked but not yet kicked off — own pick
  // read-only + the reveal button instead of dead disabled inputs.
  const editable = upcoming && !locked
  const lockedUpcoming = upcoming && locked

  // Re-render exactly when the server-corrected clock crosses the lock and kickoff
  // instants, so `editable → lockedUpcoming` and the dialog's `kickedOff` flip live
  // without a refresh (one cheap chained timer; no per-second card re-render).
  useBoundaryTick(now, [lockMs, kickoff.toMillis()])

  // The lock-timing hint shown as a tooltip on the "Locks in" chip. Strict groups lock the
  // whole group/knockout window (not this match's kickoff); lazy groups lock 10 min before.
  const lockHint =
    mode === 'strict' && cutoffs
      ? match.stage === 'GROUP_STAGE'
        ? t('predictions.strictGroupLock', {
            time: dayjs(cutoffs.firstCupMatchKickoffMs).format('MMM D, HH:mm'),
          })
        : t('predictions.strictKnockoutLock', {
            time: dayjs(cutoffs.firstKnockoutKickoffMs).format('MMM D, HH:mm'),
          })
      : t('predictions.lazyLockHint')

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

  // Points pill (ticket 032): only on a FINISHED card where the viewer predicted.
  // Ingestion-written points/breakdown are authoritative (constitution §3 — display only);
  // until they land, preview with the ONE shared engine under the group's effective config.
  let pill: ReactNode = null
  if (finished && existing && score.home !== null && score.away !== null) {
    const graded =
      existing.points !== undefined && existing.breakdown !== undefined
        ? { points: existing.points, breakdown: existing.breakdown }
        : scorePrediction(
            { home: existing.homeGoals, away: existing.awayGoals },
            { home: score.home, away: score.away },
            effectiveScoring(group ?? {}),
            match.stage,
          )
    const tier: Tier =
      graded.breakdown.exact > 0 ? 'exact' : graded.breakdown.outcome > 0 ? 'outcome' : 'miss'
    pill = <PointsPill points={graded.points} tier={tier} />
  }

  const content = (
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
          {/* Upcoming (editable OR locked): the countdown chip — past `lockMs` it
                already renders its "Locked" chip, the right signal for both. */}
          {upcoming ? (
            <CountdownToKickoff kickoffMs={lockMs} now={now} tooltip={lockHint} />
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
          {/* Name on top of flag (centered column) at every breakpoint. */}
          <Stack
            direction="column"
            spacing={0.5}
            sx={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}
          >
            <TeamName team={homeTeam} />
            <TeamFlag team={homeTeam} />
          </Stack>

          {/* Fixed-height center so swapping steppers ↔ read-only numerals ↔ result
                never changes the card's height (84px = the stepper column's height). */}
          <Box
            sx={{
              flexShrink: 0,
              px: 0.5,
              minHeight: 84,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {editable ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Spinner
                  value={homeGoals}
                  disabled={inputsDisabled}
                  onChange={setHomeGoals}
                  ariaLabel={t('predictions.teamGoals', { team: homeLabel })}
                  increaseLabel={t('predictions.increaseGoals', { team: homeLabel })}
                  decreaseLabel={t('predictions.decreaseGoals', { team: homeLabel })}
                />
                <Typography
                  variant="caption"
                  sx={{ px: 0.25, color: 'text.secondary', fontStyle: 'italic' }}
                >
                  {t('predictions.vs')}
                </Typography>
                <Spinner
                  value={awayGoals}
                  disabled={inputsDisabled}
                  onChange={setAwayGoals}
                  ariaLabel={t('predictions.teamGoals', { team: awayLabel })}
                  increaseLabel={t('predictions.increaseGoals', { team: awayLabel })}
                  decreaseLabel={t('predictions.decreaseGoals', { team: awayLabel })}
                />
              </Stack>
            ) : showResult ? (
              // Result score, with the viewer's own pick stacked subtly underneath so
              // the caption never adds a row outside the fixed zones (ticket 032).
              <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
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
                {existing && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      letterSpacing: 0.3,
                      lineHeight: 1.3,
                      maxWidth: 150,
                      textAlign: 'center',
                    }}
                  >
                    {t('predictions.yourPrediction', {
                      home: existing.homeGoals,
                      away: existing.awayGoals,
                    })}
                  </Typography>
                )}
              </Stack>
            ) : lockedUpcoming ? (
              // Locked, not kicked off: the viewer's OWN pick read-only — secondary
              // color so it can't be mistaken for a result — or a dash when none.
              existing ? (
                <Typography
                  component="p"
                  aria-label={t('predictions.predicted', {
                    home: existing.homeGoals,
                    away: existing.awayGoals,
                  })}
                  sx={{
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: '1.6rem',
                    whiteSpace: 'nowrap',
                    color: 'text.secondary',
                  }}
                >
                  {existing.homeGoals}&nbsp;–&nbsp;{existing.awayGoals}
                </Typography>
              ) : (
                // Dash + the localized "no prediction" caption stacked inside the
                // center slot — copy stays neutral because a strict group can lock
                // days before this match's kickoff.
                <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Typography
                    component="p"
                    aria-hidden
                    sx={{
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: '1.6rem',
                      whiteSpace: 'nowrap',
                      color: 'text.secondary',
                    }}
                  >
                    —
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      letterSpacing: 0.3,
                      lineHeight: 1.3,
                      maxWidth: 150,
                      textAlign: 'center',
                    }}
                  >
                    {t('predictions.noPredictionLocked')}
                  </Typography>
                </Stack>
              )
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

          <Stack
            direction="column"
            spacing={0.5}
            sx={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}
          >
            <TeamName team={awayTeam} />
            <TeamFlag team={awayTeam} />
          </Stack>
        </Stack>

        {/* Fixed-height FOOTER zone, present in EVERY state so the card never changes
              size (ticket 032): Save/Update while editable, the reveal button while
              locked or live, EMPTY when finished (the pill overlays bottom-right) or TBD. */}
        <Box
          data-testid="fixture-card-footer"
          sx={{
            height: 44,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {editable && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<EditScoreIcon />}
              disabled={inputsDisabled || !dirty}
              onClick={() => void save()}
            >
              {existing ? t('predictions.update') : t('predictions.save')}
            </Button>
          )}
          {(lockedUpcoming || live) && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<EyeIcon />}
              onClick={() => setDialogOpen(true)}
            >
              {t('predictions.openDialog')}
            </Button>
          )}
        </Box>
      </Stack>
    </CardContent>
  )

  return (
    <Card
      sx={{ position: 'relative' }}
      aria-label={t('match.versus', {
        home: teamName(homeTeam),
        away: teamName(awayTeam),
      })}
    >
      {/* Finished: the button is gone — the WHOLE card is the accessible doorway to the
          reveal dialog (CardActionArea = a real focusable button; Enter/Space included).
          The footer is empty in this state so there is no nested interactive element. */}
      {finished ? (
        <CardActionArea
          aria-label={t('predictions.openDialogCard')}
          onClick={() => setDialogOpen(true)}
        >
          {content}
        </CardActionArea>
      ) : (
        content
      )}

      {/* Bottom-right dot + points pill — finished + predicted only (ticket 032). */}
      {pill}

      {/* ONE dialog instance for the locked + live/finished states. Pre-kickoff it shows
          its rules-gated "reveals at kickoff" placeholder and issues no query (ticket 013). */}
      {(showResult || lockedUpcoming) && (
        <MatchPredictionsDialog
          gid={gid}
          match={match}
          kickedOff={kickedOff}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
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
