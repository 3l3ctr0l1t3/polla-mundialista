/**
 * CanvasPage — a design sandbox for the fixture card (superadmin / local-dev only).
 *
 * NOT a user-facing feature. It renders the upcoming/editable FixtureCard layout
 * (FixtureCardPreview) at a phone width and a desktop width side by side so we can judge the
 * card's proportions — currently the team NAME stacked above its FLAG at every breakpoint
 * (ticket 024). Nothing here writes to Firestore. Mounted in GroupApp only when
 * `isSuperAdmin || import.meta.env.DEV`.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { sampleScheduledMatch } from '../dev/sampleData'
import { FixtureCardPreview } from '../dev/FixtureCardPreview'
import {
  HamburgerDrawerPreview,
  TitleMenuPreview,
  BottomSheetPreview,
} from '../dev/GroupNavPreviews'
import { FinishedCardOptions } from '../dev/FinishedCardPreviews'

/** Widths we eyeball the card at: a phone-ish column and a roomy desktop column. */
const MOBILE_WIDTH = 400
const DESKTOP_WIDTH = 600

const clamp = (n: number): number => Math.max(0, Math.min(20, Math.floor(n)))

const bigNum = {
  minWidth: 28,
  textAlign: 'center' as const,
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
  fontSize: '1.5rem',
  lineHeight: 1,
}

/** Compact vertical goal spinner (▲ n ▼) — mirrors the production FixtureCard center slot. */
function ScoreSpinners() {
  const [home, setHome] = useState(0)
  const [away, setAway] = useState(0)
  const cell = (v: number, set: (n: number) => void, side: string) => (
    <Stack sx={{ alignItems: 'center', justifyContent: 'center' }}>
      <IconButton size="small" aria-label={`increase ${side}`} onClick={() => set(clamp(v + 1))}>
        <KeyboardArrowUpIcon fontSize="small" />
      </IconButton>
      <Typography component="span" sx={bigNum}>
        {v}
      </Typography>
      <IconButton
        size="small"
        disabled={v <= 0}
        aria-label={`decrease ${side}`}
        onClick={() => set(clamp(v - 1))}
      >
        <KeyboardArrowDownIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      {cell(home, setHome, 'home')}
      <Typography variant="caption" sx={{ px: 0.25, color: 'text.secondary', fontStyle: 'italic' }}>
        vs
      </Typography>
      {cell(away, setAway, 'away')}
    </Stack>
  )
}

export function CanvasPage() {
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', width: '100%' }}>
      <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
        Canvas
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Design sandbox — sample data, nothing is saved. Superadmin / local-dev only. The fixture
        card at mobile and desktop widths: team name stacked above the flag.
      </Alert>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        sx={{ alignItems: 'flex-start' }}
        useFlexGap
      >
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Mobile · ≈{MOBILE_WIDTH}px
          </Typography>
          <Box sx={{ width: MOBILE_WIDTH, maxWidth: '100%' }}>
            <FixtureCardPreview match={sampleScheduledMatch}>
              <ScoreSpinners />
            </FixtureCardPreview>
          </Box>
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Desktop · ≈{DESKTOP_WIDTH}px
          </Typography>
          <Box sx={{ width: DESKTOP_WIDTH, maxWidth: '100%' }}>
            <FixtureCardPreview match={sampleScheduledMatch}>
              <ScoreSpinners />
            </FixtureCardPreview>
          </Box>
        </Box>
      </Stack>

      {/* ---- Group navigation candidates (select / create / join) ------------- */}
      <Typography variant="h5" component="h2" sx={{ mt: 5, mb: 1 }}>
        Group navigation — 3 options
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Candidate replacements for the top-bar group switcher, now covering select + create + join.
        All three are clickable (sample data, nothing saved): tap the hamburger / title to open each
        one.
      </Alert>

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={3}
        sx={{ alignItems: 'flex-start' }}
        useFlexGap
      >
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            A · Hamburger → drawer
          </Typography>
          <HamburgerDrawerPreview />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Classic nav pattern; room to grow (settings, profile). One extra tap vs. the title.
          </Typography>
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            B · Title menu (current, enriched)
          </Typography>
          <TitleMenuPreview />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Smallest change from today: avatars + roles in the menu, create/join appended.
          </Typography>
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            C · Title → bottom sheet
          </Typography>
          <BottomSheetPreview />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Mobile-first: big touch rows + prominent create/join buttons. Less ideal on desktop.
          </Typography>
        </Box>
      </Stack>

      {/* ---- Finished card: result-quality indicator options ------------------ */}
      <Typography variant="h5" component="h2" sx={{ mt: 5, mb: 1 }}>
        Finished card — result indicator options
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Constant card size with the button gone: real score + your prediction + a bottom-right
        indicator of how your pick did. Colors come from the REAL scoring engine. Same match (2–1)
        with three sample predictions per option.
      </Alert>
      <FinishedCardOptions />
    </Box>
  )
}

export default CanvasPage
