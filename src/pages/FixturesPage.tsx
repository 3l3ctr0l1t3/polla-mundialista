/**
 * FixturesPage — the tournament schedule & results (ticket 004).
 *
 * Lists matches grouped by local-time day with live status/score via `useMatches`.
 * Shows Loading / Empty / Error states, plus an "updated N min ago" freshness badge
 * sourced from `config/meta.lastIngestAt` (shown only when present).
 *
 * Live data only: until the ingestion job (ticket 008) seeds Firestore, the matches
 * collection is empty and this page renders its Empty state. See `src/dev/sampleData.ts`
 * (used by tests only) for example fixtures.
 */
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import UpdateIcon from '@mui/icons-material/Update'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import { useMatches } from '../hooks/useMatches'
import { useMeta } from '../hooks/useMeta'
import { groupMatchesByDay } from '../hooks/matchGrouping'
import { MatchCard } from '../components/MatchCard'
import { LoadingState, EmptyState, ErrorState } from '../components/states'
import type { MetaConfig } from '../shared/types'

/** "updated N min ago" badge from `config/meta.lastIngestAt`; nothing if absent. */
function FreshnessBadge({ meta }: { meta: MetaConfig | null }) {
  if (!meta?.lastIngestAt) return null
  const when = meta.lastIngestAt.toDate()
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={<UpdateIcon />}
      label={`Updated ${relativeFromNow(when)}`}
      sx={{ alignSelf: 'flex-start' }}
    />
  )
}

/** Minimal relative formatter so we don't depend on dayjs' relativeTime plugin. */
function relativeFromNow(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.max(0, Math.round(diffMs / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function FixturesPage() {
  const { matches, loading, error } = useMatches()
  const { meta } = useMeta()

  return (
    <Box>
      <Stack
        direction="row"
        sx={{
          mb: 2,
          gap: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h5" component="h2">
          Fixtures
        </Typography>
        <FreshnessBadge meta={meta} />
      </Stack>

      {loading ? (
        <LoadingState rows={4} label="Loading fixtures" />
      ) : error ? (
        <ErrorState title="Couldn't load fixtures" description={error.message} />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={<EventBusyIcon fontSize="inherit" />}
          title="No fixtures yet"
          description="Match data hasn't been loaded yet. Check back once the schedule is published."
        />
      ) : (
        <Stack spacing={3}>
          {groupMatchesByDay(matches).map((day) => (
            <Box key={day.dayKey} component="section" aria-label={day.label}>
              <Typography
                variant="overline"
                component="h3"
                sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
              >
                {day.label}
              </Typography>
              <Stack spacing={1.5}>
                {day.matches.map((m) => (
                  <MatchCard key={m.matchId} match={m} />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}

export default FixturesPage
