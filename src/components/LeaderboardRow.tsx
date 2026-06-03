/**
 * LeaderboardRow — a single participant's row in the live leaderboard (ticket 007).
 *
 * Renders rank (with tied ranks shown as "T-3"), avatar + display name, total points,
 * and the tiebreaker stats (exact / outcome counts). The current user's row is
 * visually highlighted so they can find themselves quickly.
 *
 * Pure/presentational: all data comes from props. Colors come from the theme palette,
 * never hard-coded (constitution: MD3 tokens isolated in `src/theme/`).
 */
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

/**
 * The minimal shape this row renders. Both the ingestion `LeaderboardEntry` and the
 * ticket-013 `RosterEntry` (full-roster row, points default 0) satisfy it.
 */
export interface LeaderboardRowEntry {
  uid: string
  displayName: string
  photoURL: string | null
  totalPoints: number
  exactCount: number
  outcomeCount: number
  rank: number
}

export interface LeaderboardRowProps {
  /** The standings row for one participant. */
  entry: LeaderboardRowEntry
  /** When true, this entry shares its rank with another -> shown as "T-{rank}". */
  isTie?: boolean
  /** When true, highlight this row as the signed-in user. */
  isCurrentUser?: boolean
}

/** First letter of a display name, used as the avatar fallback. */
function initial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed[0].toUpperCase() : '?'
}

export function LeaderboardRow({
  entry,
  isTie = false,
  isCurrentUser = false,
}: LeaderboardRowProps) {
  const rankLabel = isTie ? `T-${entry.rank}` : `${entry.rank}`

  return (
    <ListItem
      divider
      aria-current={isCurrentUser ? 'true' : undefined}
      sx={{
        gap: 1.5,
        borderRadius: 2,
        bgcolor: isCurrentUser ? 'action.selected' : 'transparent',
      }}
    >
      <Box
        sx={{
          minWidth: 44,
          textAlign: 'center',
          fontWeight: 700,
          color: 'text.secondary',
        }}
      >
        <Typography
          component="span"
          variant="subtitle1"
          aria-label={isTie ? `Tied rank ${entry.rank}` : `Rank ${entry.rank}`}
        >
          {rankLabel}
        </Typography>
      </Box>

      <ListItemAvatar sx={{ minWidth: 'auto' }}>
        <Avatar src={entry.photoURL ?? undefined} alt="">
          {initial(entry.displayName)}
        </Avatar>
      </ListItemAvatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1" noWrap sx={{ fontWeight: isCurrentUser ? 700 : 500 }}>
          {entry.displayName}
          {isCurrentUser && (
            <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>
              You
            </Typography>
          )}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Typography variant="caption" color="text.secondary">
            Exact: {entry.exactCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Outcome: {entry.outcomeCount}
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ textAlign: 'right', pl: 1 }}>
        <Typography component="span" variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {entry.totalPoints}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          pts
        </Typography>
      </Box>
    </ListItem>
  )
}

export default LeaderboardRow
