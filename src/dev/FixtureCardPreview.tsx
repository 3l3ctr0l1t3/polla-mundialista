/**
 * FixtureCardPreview — Canvas-only presentational replica of the REAL FixtureCard
 * (its editable / "upcoming" state), with a pluggable score-input center.
 *
 * Mirrors the production card chrome exactly — caption + "Locks in" chip on top, the
 * one-line teams row (home name · flag · CENTER · flag · away name, names stacking over the
 * flags on mobile), and the Save button — so we can drop different score-input widgets into
 * the `children` slot and compare them in real context. PRESENTATIONAL ONLY: no Firestore,
 * no real lock; the chip and Save button are static. Keep this in sync with FixtureCard when
 * a winning input is chosen and ported back.
 */
import type { ReactNode } from 'react'
import dayjs from 'dayjs'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import type { Match, Team } from '../shared/types'
import { isTbdTeam } from '../hooks/matchGrouping'

export interface FixtureCardPreviewProps {
  match: Match
  /** The score-input widget under test, placed in the card's center slot. */
  children: ReactNode
}

/** A team name — outer element on its side of the line (mirrors FixtureCard.TeamName). */
function TeamName({ team, align }: { team: Team; align: 'left' | 'right' }) {
  const tbd = isTbdTeam(team)
  const name = tbd ? 'TBD' : team.name
  return (
    <Typography
      variant="body2"
      title={name}
      sx={{
        flex: { sm: 1 },
        minWidth: 0,
        maxWidth: '100%',
        width: { xs: '100%', sm: 'auto' },
        textAlign: { xs: 'center', sm: align },
        fontWeight: 600,
        lineHeight: 1.15,
        color: tbd ? 'text.secondary' : 'text.primary',
        whiteSpace: { xs: 'normal', sm: 'nowrap' },
        overflow: { sm: 'hidden' },
        textOverflow: { sm: 'ellipsis' },
      }}
    >
      {name}
    </Typography>
  )
}

/** A team flag — sits inboard, next to the score (mirrors FixtureCard.TeamFlag). */
function TeamFlag({ team }: { team: Team }) {
  const tbd = isTbdTeam(team)
  return (
    <Avatar
      src={!tbd && team.crest ? team.crest : undefined}
      alt={tbd ? 'TBD' : team.name}
      sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: 'action.hover' }}
      slotProps={{ img: { loading: 'lazy' } }}
    >
      <SportsSoccerIcon fontSize="small" />
    </Avatar>
  )
}

export function FixtureCardPreview({ match, children }: FixtureCardPreviewProps) {
  const { homeTeam, awayTeam, group, stage, kickoff } = match
  const kickoffLocal = dayjs(kickoff.toDate())
  const caption = `${group ? `Group ${group}` : stage} · ${kickoffLocal.format('MMM D, HH:mm')}`

  return (
    <Card aria-label={`${homeTeam.name} versus ${awayTeam.name}`}>
      <CardContent sx={{ py: 2, textAlign: 'center', '&:last-child': { pb: 2 } }}>
        <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
          {/* Top row: caption left, "Locks in" chip top-right (static here). */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
          >
            <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
              {caption}
            </Typography>
            <Chip
              icon={<AccessTimeIcon />}
              label="Locks in 2d 4h"
              size="small"
              color="secondary"
              variant="outlined"
            />
          </Stack>

          {/* One line: home name · home flag · score input · away flag · away name. */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 0.5, sm: 1 }}
              sx={{
                flex: 1,
                minWidth: 0,
                alignItems: 'center',
                justifyContent: { sm: 'flex-end' },
              }}
            >
              <TeamName team={homeTeam} align="right" />
              <TeamFlag team={homeTeam} />
            </Stack>

            <Box sx={{ flexShrink: 0, px: 0.5 }}>{children}</Box>

            <Stack
              direction={{ xs: 'column', sm: 'row-reverse' }}
              spacing={{ xs: 0.5, sm: 1 }}
              sx={{
                flex: 1,
                minWidth: 0,
                alignItems: 'center',
                justifyContent: { sm: 'flex-end' },
              }}
            >
              <TeamName team={awayTeam} align="left" />
              <TeamFlag team={awayTeam} />
            </Stack>
          </Stack>

          <Button variant="contained" color="primary" size="small">
            Save
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default FixtureCardPreview
