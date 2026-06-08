/**
 * StandingsTable — one group's standings table (ticket 004).
 *
 * Columns: Played / Won / Drawn / Lost / Goals For / Goals Against / Goal
 * Difference / Points. Read-only; rows come from a `Standing` document written by
 * the ingestion service account. All colors come from the MUI theme.
 */
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Avatar from '@mui/material/Avatar'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import type { Standing } from '../shared/types'
import { isTbdTeam } from '../hooks/matchGrouping'
import { useTeamName } from '../i18n/useTeamName'

export interface StandingsTableProps {
  standing: Standing
}

/** Numeric column headers with accessible full labels. */
const NUMERIC_COLS: { key: string; short: string; full: string }[] = [
  { key: 'playedGames', short: 'P', full: 'Played' },
  { key: 'won', short: 'W', full: 'Won' },
  { key: 'draw', short: 'D', full: 'Drawn' },
  { key: 'lost', short: 'L', full: 'Lost' },
  { key: 'goalsFor', short: 'GF', full: 'Goals for' },
  { key: 'goalsAgainst', short: 'GA', full: 'Goals against' },
  { key: 'goalDifference', short: 'GD', full: 'Goal difference' },
  { key: 'points', short: 'Pts', full: 'Points' },
]

export function StandingsTable({ standing }: StandingsTableProps) {
  const teamName = useTeamName()
  const rows = [...standing.table].sort((a, b) => a.position - b.position)

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Typography
        variant="subtitle1"
        component="h3"
        sx={{ px: 2, py: 1, fontWeight: 700, bgcolor: 'action.hover' }}
      >
        Group {standing.groupId}
      </Typography>
      <TableContainer>
        <Table size="small" aria-label={`Group ${standing.groupId} standings`}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
              {NUMERIC_COLS.map((c) => (
                <TableCell key={c.key} align="right" sx={{ fontWeight: 700 }}>
                  <abbr title={c.full} style={{ textDecoration: 'none' }}>
                    {c.short}
                  </abbr>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const tbd = isTbdTeam(row.team)
              const name = teamName(row.team)
              return (
                <TableRow key={`${standing.groupId}-${row.position}-${row.team.id}`}>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
                      <Typography
                        variant="body2"
                        component="span"
                        sx={{ color: 'text.secondary', minWidth: 16 }}
                      >
                        {row.position}
                      </Typography>
                      <Avatar
                        src={!tbd && row.team.crest ? row.team.crest : undefined}
                        alt=""
                        aria-hidden
                        sx={{ width: 22, height: 22, bgcolor: 'action.selected' }}
                        slotProps={{ img: { loading: 'lazy' } }}
                      >
                        <SportsSoccerIcon sx={{ fontSize: 14 }} />
                      </Avatar>
                      <Box
                        component="span"
                        sx={{
                          fontWeight: 600,
                          color: tbd ? 'text.secondary' : 'text.primary',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={name}
                      >
                        {name}
                      </Box>
                    </Stack>
                  </TableCell>
                  {NUMERIC_COLS.map((c) => {
                    const value = row[c.key as keyof typeof row] as number
                    const display =
                      c.key === 'goalDifference' && value > 0 ? `+${value}` : `${value}`
                    return (
                      <TableCell
                        key={c.key}
                        align="right"
                        sx={{
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: c.key === 'points' ? 700 : 400,
                        }}
                      >
                        {display}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

export default StandingsTable
