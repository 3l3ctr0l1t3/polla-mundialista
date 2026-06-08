/**
 * PredictionsPage — the core participant interaction (ticket 005).
 *
 * Lists upcoming matches (not yet finished, ordered by kickoff) grouped by local-time day,
 * and for each renders a prediction card in the same visual language as the Fixtures page:
 * the shared `MatchTeams` header (crests/flags, names, group/stage · date, a live countdown)
 * with the participant's score steppers embedded below, prefilled from their saved
 * predictions. Provides Loading / Empty / Error states.
 *
 * Matches are read via a small local `onSnapshot` subscription so this page has no hard
 * dependency on ticket 004's `src/hooks/useMatches.ts` (owned by a parallel agent).
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import { useTranslation } from 'react-i18next'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { matchesCol } from '../firebase/db'
import { LoadingState, EmptyState, ErrorState } from '../components/states'
import { PredictionCard } from '../components/PredictionCard'
import { groupMatchesByDay } from '../hooks/matchGrouping'
import { useGroupPredictions } from '../hooks/useGroupPredictions'
import { useGroup } from '../group/useGroup'
import { useServerTime } from '../hooks/useServerTime'
import type { Match } from '../shared/types'

/** Matches whose result is not yet final are "upcoming" for prediction purposes. */
const FINAL_STATUSES = new Set(['FINISHED', 'CANCELLED', 'POSTPONED'])

function useUpcomingMatches() {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const q = query(matchesCol, orderBy('kickoff', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => d.data())
        setMatches(all.filter((m) => !FINAL_STATUSES.has(m.status)))
        setError(null)
      },
      (err) => setError(err),
    )
    return unsubscribe
  }, [])

  return { matches, error }
}

export function PredictionsPage() {
  const { t } = useTranslation()
  const { gid } = useGroup()
  const { matches, error } = useUpcomingMatches()
  const { predictions, error: predError } = useGroupPredictions(gid)
  const { now } = useServerTime()

  return (
    <Box>
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        {t('predictions.title')}
      </Typography>

      {error || predError ? (
        <ErrorState
          title={t('predictions.errorTitle')}
          description={(error ?? predError)?.message}
        />
      ) : matches === null ? (
        <LoadingState rows={4} label={t('predictions.loading')} />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={<EventBusyIcon fontSize="inherit" />}
          title={t('predictions.emptyTitle')}
          description={t('predictions.emptyDescription')}
        />
      ) : (
        <Stack spacing={3}>
          {groupMatchesByDay(matches).map((day) => (
            <Box key={day.dayKey} component="section" aria-label={day.label}>
              <Typography
                variant="overline"
                component="h2"
                sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
              >
                {day.label}
              </Typography>
              <Stack spacing={1.5}>
                {day.matches.map((match) => (
                  <PredictionCard
                    key={match.matchId}
                    gid={gid}
                    match={match}
                    existing={predictions[match.matchId]}
                    now={now}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}

export default PredictionsPage
