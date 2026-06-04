/**
 * MatchTeams — the shared presentational header for a fixture.
 *
 * Renders both teams (crest avatar + name) with a configurable center slot between them
 * (a score, a kickoff time, or a scoreline-input separator), an optional leading caption
 * (group/stage · date) and an optional trailing chip (status / countdown). Knockout
 * fixtures with undecided teams render as **TBD** placeholders without crashing.
 *
 * Used by both `MatchCard` (Fixtures) and `PredictionCard` (Predictions) so flags, names
 * and spacing render identically across the two pages. Read-only & presentational: it never
 * touches Firestore. All colors come from the MUI theme — no hard-coded palette values.
 */
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import type { Team } from '../shared/types'
import { isTbdTeam } from '../hooks/matchGrouping'

export const TBD_LABEL = 'TBD'

export interface MatchTeamsProps {
  homeTeam: Team
  awayTeam: Team
  /** Content placed between the two teams (score, kickoff time, or a separator). */
  center: ReactNode
  /** Optional caption row above the teams (e.g. "Group A · Jun 11"). */
  caption?: ReactNode
  /** Optional trailing element on the caption row (e.g. a status chip or countdown). */
  trailing?: ReactNode
}

function TeamRow({ team, align }: { team: Team; align: 'start' | 'end' }) {
  const tbd = isTbdTeam(team)
  const name = tbd ? TBD_LABEL : team.name
  const crest = !tbd && team.crest ? team.crest : undefined
  const avatar = (
    <Avatar
      src={crest}
      alt=""
      aria-hidden
      sx={{ width: 28, height: 28, bgcolor: 'action.hover' }}
      slotProps={{ img: { loading: 'lazy' } }}
    >
      <SportsSoccerIcon fontSize="small" />
    </Avatar>
  )
  return (
    <Stack
      direction={align === 'end' ? 'row-reverse' : 'row'}
      spacing={1}
      sx={{
        minWidth: 0,
        flex: 1,
        alignItems: 'center',
        justifyContent: align === 'end' ? 'flex-end' : 'flex-start',
      }}
    >
      {avatar}
      <Typography
        variant="body1"
        noWrap
        sx={{ fontWeight: 600, color: tbd ? 'text.secondary' : 'text.primary' }}
        title={name}
      >
        {name}
      </Typography>
    </Stack>
  )
}

export function MatchTeams({ homeTeam, awayTeam, center, caption, trailing }: MatchTeamsProps) {
  return (
    <>
      {(caption || trailing) && (
        <Stack
          direction="row"
          sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
        >
          {caption ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              {caption}
            </Typography>
          ) : (
            <span />
          )}
          {trailing}
        </Stack>
      )}

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <TeamRow team={homeTeam} align="start" />
        <Box sx={{ px: 1, textAlign: 'center', minWidth: 56 }}>{center}</Box>
        <TeamRow team={awayTeam} align="end" />
      </Stack>
    </>
  )
}

export default MatchTeams
