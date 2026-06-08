/**
 * StandingsPage — the 12 World Cup group tables (ticket 004).
 *
 * Renders one `StandingsTable` per group (A–L) from live `useStandings` data, with
 * Loading / Empty / Error states. Read-only.
 *
 * Live data only: empty until the ingestion job (ticket 008) seeds Firestore, at
 * which point this page leaves the Empty state.
 */
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import { useTranslation } from 'react-i18next'
import { useStandings } from '../hooks/useStandings'
import { StandingsTable } from '../components/StandingsTable'
import { LoadingState, EmptyState, ErrorState } from '../components/states'

export function StandingsPage() {
  const { t } = useTranslation()
  const { standings, loading, error } = useStandings()

  return (
    <Box>
      <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
        {t('standings.title')}
      </Typography>

      {loading ? (
        <LoadingState rows={4} label={t('standings.loading')} />
      ) : error ? (
        <ErrorState title={t('standings.errorTitle')} description={error.message} />
      ) : standings.length === 0 ? (
        <EmptyState
          icon={<LeaderboardIcon fontSize="inherit" />}
          title={t('standings.emptyTitle')}
          description={t('standings.emptyDescription')}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            alignItems: 'start',
          }}
        >
          {standings.map((standing) => (
            <StandingsTable key={standing.groupId} standing={standing} />
          ))}
        </Box>
      )}
    </Box>
  )
}

export default StandingsPage
