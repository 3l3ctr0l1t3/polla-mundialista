/**
 * LeaderboardPage — the live ranked board over the FULL roster (tickets 007 + 013).
 *
 * Reads the group's full participant roster via `useGroupRoster(gid)` — all approved
 * members plus the owner, each with their points (0 if not yet graded). This lists
 * everyone who is playing the moment they're approved, independent of when ingestion
 * last ran. Points still come solely from ingestion's `leaderboard/{uid}` aggregate
 * (two-writers rule); this page is a pure reader and updates live.
 *
 * States: loading skeleton, error placeholder, and an empty state (only if the group
 * has truly no participants — which won't happen, the owner is always present). Raw
 * predictions are never read here — only the per-member point totals.
 */
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import LeaderboardIcon from '@mui/icons-material/EmojiEvents'
import { useGroupRoster } from '../hooks/useGroupRoster'
import { LeaderboardRow } from '../components/LeaderboardRow'
import { EmptyState, ErrorState, LoadingState } from '../components/states'
import { useAuth } from '../auth/useAuth'
import { useGroup } from '../group/useGroup'

export function LeaderboardPage() {
  const { gid } = useGroup()
  const { roster, loading, error } = useGroupRoster(gid)
  const { user } = useAuth()

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h5" component="h1" sx={{ mb: 0.5 }}>
        Leaderboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Everyone in the group is listed. Points update after each results ingestion run.
      </Typography>

      {loading ? (
        <LoadingState rows={5} label="Loading leaderboard" />
      ) : error ? (
        <ErrorState
          title="Couldn’t load the leaderboard"
          description="The standings will appear once the connection recovers."
        />
      ) : roster.length === 0 ? (
        <EmptyState
          icon={<LeaderboardIcon fontSize="inherit" />}
          title="No participants yet"
          description="Approved members appear here as soon as they join."
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <List disablePadding aria-label="Leaderboard standings">
            {roster.map((entry) => (
              <LeaderboardRow
                key={entry.uid}
                entry={entry}
                isTie={entry.isTie}
                isCurrentUser={user?.uid === entry.uid}
              />
            ))}
          </List>
        </Paper>
      )}
    </Box>
  )
}

export default LeaderboardPage
