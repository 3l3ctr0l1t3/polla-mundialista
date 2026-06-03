/**
 * PredictionsPage — the core participant interaction (ticket 005).
 *
 * Lists upcoming matches (not yet finished, ordered by kickoff) and, for each, renders a
 * server-time countdown and the participant's prediction input prefilled from their saved
 * predictions. Provides Loading / Empty / Error states.
 *
 * Matches are read via a small local `onSnapshot` subscription so this page has no hard
 * dependency on ticket 004's `src/hooks/useMatches.ts` (owned by a parallel agent).
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { matchesCol } from '../firebase/db'
import { LoadingState, EmptyState, ErrorState } from '../components/states'
import { CountdownToKickoff } from '../components/CountdownToKickoff'
import { PredictionInput } from '../components/PredictionInput'
import { useMyPredictions } from '../hooks/useMyPredictions'
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
  const { matches, error } = useUpcomingMatches()
  const { predictions, error: predError } = useMyPredictions()
  const { now } = useServerTime()

  if (error || predError) {
    return (
      <ErrorState title="Couldn't load predictions" description={(error ?? predError)?.message} />
    )
  }

  if (matches === null) {
    return <LoadingState rows={4} label="Loading matches" />
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        title="No upcoming matches"
        description="Predictions will open as soon as the fixtures are scheduled."
      />
    )
  }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', width: '100%' }}>
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        Your predictions
      </Typography>
      <Stack spacing={2}>
        {matches.map((match) => (
          <Paper key={match.matchId} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                mb: 1.5,
              }}
            >
              <Typography variant="subtitle1" component="h2">
                {match.homeTeam.shortName} vs {match.awayTeam.shortName}
              </Typography>
              <CountdownToKickoff kickoffMs={match.kickoff.toMillis()} now={now} />
            </Box>
            <PredictionInput match={match} existing={predictions[match.matchId]} now={now} />
          </Paper>
        ))}
      </Stack>
    </Box>
  )
}

export default PredictionsPage
