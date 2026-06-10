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
import { useState } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import LeaderboardIcon from '@mui/icons-material/EmojiEvents'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineRounded'
import { useTranslation } from 'react-i18next'
import { useGroupRoster } from '../hooks/useGroupRoster'
import { LeaderboardRow } from '../components/LeaderboardRow'
import { ScoringExplainer } from '../components/ScoringExplainer'
import { EmptyState, ErrorState, LoadingState } from '../components/states'
import { useAuth } from '../auth/useAuth'
import { useGroup } from '../group/useGroup'

export function LeaderboardPage() {
  const { t } = useTranslation()
  const { gid } = useGroup()
  const { roster, loading, error } = useGroupRoster(gid)
  const { user } = useAuth()
  const [explainerOpen, setExplainerOpen] = useState(false)

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}
      >
        <Typography variant="h5" component="h1">
          {t('leaderboard.title')}
        </Typography>
        <IconButton
          onClick={() => setExplainerOpen(true)}
          aria-label={t('scoring.open')}
          color="primary"
        >
          <HelpOutlineIcon />
        </IconButton>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('leaderboard.subtitle')}
      </Typography>

      <ScoringExplainer open={explainerOpen} onClose={() => setExplainerOpen(false)} />

      {loading ? (
        <LoadingState rows={5} label={t('leaderboard.loading')} />
      ) : error ? (
        <ErrorState
          title={t('leaderboard.errorTitle')}
          description={t('leaderboard.errorDescription')}
        />
      ) : roster.length === 0 ? (
        <EmptyState
          icon={<LeaderboardIcon fontSize="inherit" />}
          title={t('leaderboard.emptyTitle')}
          description={t('leaderboard.emptyDescription')}
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <List disablePadding aria-label={t('leaderboard.standingsAria')}>
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
