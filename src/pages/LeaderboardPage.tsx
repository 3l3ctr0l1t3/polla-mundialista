/**
 * LeaderboardPage — the live ranked board (ticket 007).
 *
 * Reads the group's public aggregate via `useGroupLeaderboard(gid)` (an `onSnapshot`
 * listener) and renders a ranked list. Rankings are computed by the ingestion job per
 * group; this page is a pure reader and updates live when new aggregates are written.
 *
 * States: loading skeleton, error placeholder, and an empty state (the leaderboard is
 * empty until the ingestion job grades predictions and writes `leaderboard/{uid}`).
 * Raw predictions are never read here — only the aggregate, so picks stay private.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import LeaderboardIcon from '@mui/icons-material/EmojiEvents'
import { useGroupLeaderboard } from '../hooks/useGroupLeaderboard'
import { LeaderboardRow } from '../components/LeaderboardRow'
import { EmptyState, ErrorState, LoadingState } from '../components/states'
import { useAuth } from '../auth/useAuth'
import { useGroup } from '../group/useGroup'

export function LeaderboardPage() {
  const { gid } = useGroup()
  const { entries, loading, error } = useGroupLeaderboard(gid)
  const { user } = useAuth()

  // A rank is "tied" when more than one entry shares it (dense rank from ingestion).
  const tiedRanks = useMemo(() => {
    const counts = new Map<number, number>()
    for (const e of entries) counts.set(e.rank, (counts.get(e.rank) ?? 0) + 1)
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([rank]) => rank))
  }, [entries])

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h5" component="h1" sx={{ mb: 0.5 }}>
        Leaderboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Rankings update after each results ingestion run.
      </Typography>

      {loading ? (
        <LoadingState rows={5} label="Loading leaderboard" />
      ) : error ? (
        <ErrorState
          title="Couldn’t load the leaderboard"
          description="The standings will appear once the connection recovers."
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<LeaderboardIcon fontSize="inherit" />}
          title="No standings yet"
          description="The board fills in once matches are played and results are graded."
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <List disablePadding aria-label="Leaderboard standings">
            {entries.map((entry) => (
              <LeaderboardRow
                key={entry.uid}
                entry={entry}
                isTie={tiedRanks.has(entry.rank)}
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
