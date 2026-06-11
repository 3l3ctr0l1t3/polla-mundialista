/**
 * FinishedCardPreviews — Canvas-only mockups for the FINISHED fixture card (local
 * iteration, not deployed): constant card size with the action button gone, showing
 * the real score + the viewer's prediction + a RESULT-QUALITY indicator in the
 * bottom-right corner.
 *
 * Three indicator options (A/B/C), each shown for the same finished match (2–1) with
 * three sample predictions: exact (2–1), right winner only (1–0), and missed (0–2).
 * Colors come from the REAL scoring engine (`scorePrediction`) + theme palette:
 *   green  = exact scoreline       (success)
 *   orange = right outcome only    (warning)
 *   red    = missed                (error)
 *
 * PRESENTATIONAL ONLY: sample data, no Firestore. Port the winner into FixtureCard
 * under its own ticket.
 */
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import { scorePrediction, DEFAULT_SCORING, type Scoreline } from '../shared/scoring'

/* ------------------------------------------------------------------ data */

const ACTUAL: Scoreline = { home: 2, away: 1 } // Mexico 2 – 1 Canada

interface Sample {
  label: string
  pred: Scoreline
}

const SAMPLES: Sample[] = [
  { label: 'Exact (2–1)', pred: { home: 2, away: 1 } },
  { label: 'Right winner (1–0)', pred: { home: 1, away: 0 } },
  { label: 'Missed (0–2)', pred: { home: 0, away: 2 } },
]

/** Tier → theme palette key. */
function tierColor(pred: Scoreline): 'success.main' | 'warning.main' | 'error.main' {
  const { breakdown } = scorePrediction(pred, ACTUAL, DEFAULT_SCORING, 'GROUP_STAGE')
  if (breakdown.exact > 0) return 'success.main'
  if (breakdown.outcome > 0) return 'warning.main'
  return 'error.main'
}

function resultOf(pred: Scoreline) {
  return scorePrediction(pred, ACTUAL, DEFAULT_SCORING, 'GROUP_STAGE')
}

/* ----------------------------------------------------------- card chrome */

function TeamCol({ name }: { name: string }) {
  return (
    <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'center', lineHeight: 1.15 }}>
        {name}
      </Typography>
      <Avatar sx={{ width: 28, height: 28, bgcolor: 'action.hover' }}>
        <SportsSoccerIcon fontSize="small" />
      </Avatar>
    </Stack>
  )
}

/**
 * The finished card shell: SAME fixed height in every variant (the old button row is
 * gone and nothing collapses), score center, own prediction below, and the indicator
 * pinned to the bottom-right corner.
 */
function FinishedCard({ pred, indicator }: { pred: Scoreline; indicator: ReactNode }) {
  return (
    <Card sx={{ width: 280, flexShrink: 0, position: 'relative' }}>
      <CardContent sx={{ py: 2, minHeight: 168, '&:last-child': { pb: 2 } }}>
        <Stack spacing={1.25} sx={{ alignItems: 'center' }}>
          <Stack
            direction="row"
            sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography variant="caption" color="text.secondary" noWrap>
              Group A · Jun 11, 19:00
            </Typography>
            <Chip size="small" label="Finished" color="success" variant="outlined" />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ width: '100%', alignItems: 'center' }}>
            <TeamCol name="Mexico" />
            <Typography
              sx={{
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                fontSize: '1.6rem',
                whiteSpace: 'nowrap',
                px: 0.5,
              }}
            >
              {ACTUAL.home}&nbsp;–&nbsp;{ACTUAL.away}
            </Typography>
            <TeamCol name="Canada" />
          </Stack>

          <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.3 }}>
            Your prediction: {pred.home} – {pred.away}
          </Typography>
        </Stack>
      </CardContent>

      {/* Bottom-right result indicator (the variant under test). */}
      <Box sx={{ position: 'absolute', right: 10, bottom: 8 }}>{indicator}</Box>
    </Card>
  )
}

/** A single colored dot. */
function Dot({ color, dim, size = 10 }: { color: string; dim?: boolean; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: dim ? 'transparent' : color,
        border: 1,
        borderColor: dim ? 'divider' : color,
        flexShrink: 0,
      }}
    />
  )
}

/* -------------------------------------------------------------- variants */

/** A — ONE dot, colored by the best tier you hit (tooltip = points). */
function VariantA({ pred }: { pred: Scoreline }) {
  const { points } = resultOf(pred)
  return (
    <Tooltip title={`${points} pts`}>
      <Box sx={{ p: 0.5 }}>
        <Dot color={tierColor(pred)} />
      </Box>
    </Tooltip>
  )
}

/** B — THREE tier dots (winner · goal diff · exact): earned = lit, not = dim outline. */
function VariantB({ pred }: { pred: Scoreline }) {
  const { breakdown } = resultOf(pred)
  const outcomeHit = breakdown.outcome > 0 || breakdown.exact > 0
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', p: 0.5 }}>
      <Tooltip title="Winner">
        <Box>
          <Dot color="warning.main" dim={!outcomeHit} />
        </Box>
      </Tooltip>
      <Tooltip title="Goal difference">
        <Box>
          <Dot color="info.main" dim={breakdown.goalDiff === 0} />
        </Box>
      </Tooltip>
      <Tooltip title="Exact score">
        <Box>
          <Dot color="success.main" dim={breakdown.exact === 0} />
        </Box>
      </Tooltip>
    </Stack>
  )
}

/** C — dot + points pill, tinted by the best tier. */
function VariantC({ pred }: { pred: Scoreline }) {
  const { points } = resultOf(pred)
  const color = tierColor(pred)
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: 999,
        border: 1,
        borderColor: color,
      }}
    >
      <Dot color={color} size={8} />
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}
      >
        {points} pts
      </Typography>
    </Stack>
  )
}

/* -------------------------------------------------------------- sections */

function VariantRow({
  title,
  legend,
  render,
}: {
  title: string
  legend: string
  render: (pred: Scoreline) => ReactNode
}) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {title}
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap sx={{ mb: 1 }}>
        {SAMPLES.map((s) => (
          <Box key={s.label}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {s.label}
            </Typography>
            <FinishedCard pred={s.pred} indicator={render(s.pred)} />
          </Box>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {legend}
      </Typography>
    </Box>
  )
}

export function FinishedCardOptions() {
  return (
    <Stack spacing={4}>
      <VariantRow
        title="A · One status dot (best tier)"
        legend="One dot: green = exact score · orange = right winner · red = missed. Hover/tap for points."
        render={(pred) => <VariantA pred={pred} />}
      />
      <VariantRow
        title="B · Three tier dots (winner · goal diff · exact)"
        legend="Each scoring tier gets its own dot — lit when earned, dim outline when not: orange = winner, blue = goal difference, green = exact."
        render={(pred) => <VariantB pred={pred} />}
      />
      <VariantRow
        title="C · Dot + points pill"
        legend="The earned points in a small pill, tinted by the best tier (green / orange / red)."
        render={(pred) => <VariantC pred={pred} />}
      />
    </Stack>
  )
}

export default FinishedCardOptions
