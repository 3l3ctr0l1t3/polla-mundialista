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
import type { TFunction } from 'i18next'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import UpdateIcon from '@mui/icons-material/Update'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import { useTranslation } from 'react-i18next'
import { useMatches } from '../hooks/useMatches'
import { useMeta } from '../hooks/useMeta'
import { groupMatchesByDay } from '../hooks/matchGrouping'
import { FixtureCard } from '../components/FixtureCard'
import { useGroup } from '../group/useGroup'
import { useGroupPredictions } from '../hooks/useGroupPredictions'
import { useServerTime } from '../hooks/useServerTime'
import { LoadingState, EmptyState, ErrorState } from '../components/states'
import type { MetaConfig } from '../shared/types'

/** "updated N min ago" badge from `config/meta.lastIngestAt`; nothing if absent. */
function FreshnessBadge({ meta }: { meta: MetaConfig | null }) {
  const { t } = useTranslation()
  if (!meta?.lastIngestAt) return null
  const when = meta.lastIngestAt.toDate()
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={<UpdateIcon />}
      label={t('fixtures.updated', { when: relativeFromNow(when, t) })}
      sx={{ alignSelf: 'flex-start' }}
    />
  )
}

/** Minimal relative formatter so we don't depend on dayjs' relativeTime plugin. */
function relativeFromNow(date: Date, t: TFunction): string {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.max(0, Math.round(diffMs / 60000))
  if (mins < 1) return t('fixtures.justNow')
  if (mins < 60) return t('fixtures.minAgo', { count: mins })
  const hours = Math.round(mins / 60)
  if (hours < 24) return t('fixtures.hrAgo', { count: hours })
  const days = Math.round(hours / 24)
  return t('fixtures.dayAgo', { count: days })
}

export function FixturesPage() {
  const { t } = useTranslation()
  const { matches, loading, error } = useMatches()
  const { meta } = useMeta()
  const { gid } = useGroup()
  const { predictions } = useGroupPredictions(gid)
  const { now } = useServerTime()

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
          {t('fixtures.title')}
        </Typography>
        <FreshnessBadge meta={meta} />
      </Stack>

      {loading ? (
        <LoadingState rows={4} label={t('fixtures.loading')} />
      ) : error ? (
        <ErrorState title={t('fixtures.errorTitle')} description={error.message} />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={<EventBusyIcon fontSize="inherit" />}
          title={t('fixtures.emptyTitle')}
          description={t('fixtures.emptyDescription')}
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
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  // Compact cards: as many columns as fit, but a card never stretches
                  // past 360px — wide screens get more columns, not wider cards.
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 360px))',
                  justifyContent: 'center',
                  alignItems: 'start',
                }}
              >
                {day.matches.map((m) => (
                  <FixtureCard
                    key={m.matchId}
                    gid={gid}
                    match={m}
                    existing={predictions[m.matchId]}
                    now={now}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}

export default FixturesPage
