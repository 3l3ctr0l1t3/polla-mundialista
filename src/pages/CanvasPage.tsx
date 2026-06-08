/**
 * CanvasPage — a design sandbox for the match component (superadmin / local-dev only).
 *
 * NOT a user-facing feature: it renders the experimental MatchLabCard against sample data
 * (src/dev/sampleData.ts) so we can iterate on folding the prediction steppers into the
 * fixture card (the goal: retire the separate Predictions page). Nothing here writes to
 * Firestore. Mounted in GroupApp only when `isSuperAdmin || import.meta.env.DEV`.
 */
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import {
  sampleScheduledMatch,
  sampleLiveMatch,
  sampleFinishedMatch,
  sampleTbdMatch,
} from '../dev/sampleData'
import { MatchCard } from '../components/MatchCard'
import { MatchLabCard } from '../components/MatchLabCard'

const SAMPLES = [
  { label: 'Scheduled (predictable)', match: sampleScheduledMatch },
  { label: 'Live', match: sampleLiveMatch, pick: { home: 1, away: 1 } },
  { label: 'Finished', match: sampleFinishedMatch, pick: { home: 2, away: 1 } },
  { label: 'Knockout TBD', match: sampleTbdMatch },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section">
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {title}
      </Typography>
      <Stack spacing={1.5}>{children}</Stack>
    </Box>
  )
}

export function CanvasPage() {
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', width: '100%' }}>
      <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
        Canvas
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Design sandbox — sample data, nothing is saved. Superadmin / local-dev only.
      </Alert>

      <Stack spacing={3}>
        <Section title="MatchLabCard — centered (name · flag · prediction)">
          {SAMPLES.map(({ label, match, pick }) => (
            <Box key={`lab-${match.matchId}`}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <MatchLabCard match={match} prediction={pick} />
              </Box>
            </Box>
          ))}
        </Section>

        <Section title="Current MatchCard (for comparison)">
          {SAMPLES.map(({ label, match }) => (
            <Box key={`cur-${match.matchId}`}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <MatchCard match={match} />
              </Box>
            </Box>
          ))}
        </Section>
      </Stack>
    </Box>
  )
}

export default CanvasPage
