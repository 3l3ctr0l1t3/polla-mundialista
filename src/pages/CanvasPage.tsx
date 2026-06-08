/**
 * CanvasPage — a design sandbox for the fixture card (superadmin / local-dev only).
 *
 * NOT a user-facing feature. It renders the upcoming/editable FixtureCard layout
 * (FixtureCardPreview) once per score-input option so we can compare DIFFERENT ways to
 * enter a predicted scoreline while the rest of the card stays identical. Nothing here
 * writes to Firestore. Mounted in GroupApp only when `isSuperAdmin || import.meta.env.DEV`.
 */
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import { sampleScheduledMatch } from '../dev/sampleData'
import { SCORE_INPUT_OPTIONS } from '../dev/scoreInputs'
import { FixtureCardPreview } from '../dev/FixtureCardPreview'

/** Phone-ish width so we judge how each input fits the real (mobile-first) card. */
const PHONE_WIDTH = 400

export function CanvasPage() {
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', width: '100%' }}>
      <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
        Canvas
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Design sandbox — sample data, nothing is saved. Superadmin / local-dev only. Same fixture
        card, different score-input options to compare.
      </Alert>

      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Fixture card · score-input options (≈{PHONE_WIDTH}px / mobile)
      </Typography>

      <Stack spacing={3}>
        {SCORE_INPUT_OPTIONS.map(({ id, label, Component }) => (
          <Box key={id}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {label}
            </Typography>
            <Box sx={{ maxWidth: PHONE_WIDTH }}>
              <FixtureCardPreview match={sampleScheduledMatch}>
                <Component />
              </FixtureCardPreview>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

export default CanvasPage
