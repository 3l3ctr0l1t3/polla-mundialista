/**
 * PredictionInput — the participant's scoreline entry for a single match.
 *
 * Two integer goal steppers (home/away, ints ≥ 0). Inputs are disabled at/after kickoff
 * using the server-corrected clock (`now()`); the authoritative gate is `firestore.rules`.
 *
 * On submit it writes only the user's own prediction via
 * `setDoc(predictions/{uid}_{matchId}, {...}, { merge: true })`:
 *   - `uid`, `matchId`, `homeGoals`, `awayGoals` always,
 *   - `updatedAt: serverTimestamp()` always,
 *   - `createdAt: serverTimestamp()` ONLY when the prediction is new.
 * It never writes `points`/`breakdown` (ingestion-only — two-writers rule).
 *
 * A rules-rejected late write (`permission-denied`) surfaces a "match already started"
 * snackbar so the UI degrades honestly when the device clock disagreed with the server.
 *
 * Colors/shape come from the MUI theme — no hard-coded values.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { predictionDoc } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import type { Match, Prediction } from '../shared/types'

export interface PredictionInputProps {
  match: Match
  /** The user's existing saved prediction for this match, if any (prefills the steppers). */
  existing?: Prediction
  /** Server-corrected current time in ms (drives the kickoff lock). */
  now: () => number
}

/** Clamp arbitrary input to a non-negative integer. */
function toGoals(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

interface StepperProps {
  label: string
  value: number
  disabled: boolean
  onChange: (next: number) => void
}

function GoalStepper({ label, value, disabled, onChange }: StepperProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" component="span">
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton
          size="small"
          disabled={disabled || value <= 0}
          aria-label={`Decrease ${label} goals`}
          onClick={() => onChange(toGoals(value - 1))}
        >
          <RemoveIcon fontSize="small" />
        </IconButton>
        <TextField
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(toGoals(Number(e.target.value)))}
          size="small"
          type="number"
          slotProps={{
            htmlInput: {
              min: 0,
              step: 1,
              inputMode: 'numeric',
              'aria-label': `${label} goals`,
              style: { textAlign: 'center', width: '3ch' },
            },
          }}
          sx={{ width: 72 }}
        />
        <IconButton
          size="small"
          disabled={disabled}
          aria-label={`Increase ${label} goals`}
          onClick={() => onChange(toGoals(value + 1))}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  )
}

export function PredictionInput({ match, existing, now }: PredictionInputProps) {
  const { user } = useAuth()
  const [homeGoals, setHomeGoals] = useState<number>(existing?.homeGoals ?? 0)
  const [awayGoals, setAwayGoals] = useState<number>(existing?.awayGoals ?? 0)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(
    null,
  )

  // Keep local state in sync when a prediction arrives/changes from the snapshot.
  useEffect(() => {
    setHomeGoals(existing?.homeGoals ?? 0)
    setAwayGoals(existing?.awayGoals ?? 0)
  }, [existing?.homeGoals, existing?.awayGoals])

  const kickoffMs = match.kickoff.toMillis()
  const locked = now() >= kickoffMs
  const disabled = locked || saving || !user

  async function handleSubmit() {
    if (!user || locked) return
    setSaving(true)
    try {
      const ref = predictionDoc(user.uid, match.matchId)
      // `createdAt` only on first write; `updatedAt` always. Never points/breakdown.
      const payload: Partial<Prediction> = {
        uid: user.uid,
        matchId: match.matchId,
        homeGoals: toGoals(homeGoals),
        awayGoals: toGoals(awayGoals),
        updatedAt: serverTimestamp() as unknown as Prediction['updatedAt'],
      }
      if (!existing) {
        payload.createdAt = serverTimestamp() as unknown as Prediction['createdAt']
      }
      await setDoc(ref, payload, { merge: true })
      setSnack({ message: 'Prediction saved', severity: 'success' })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'permission-denied') {
        setSnack({
          message: 'This match already started — predictions are locked.',
          severity: 'error',
        })
      } else {
        setSnack({
          message: 'Could not save your prediction. Please try again.',
          severity: 'error',
        })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <GoalStepper
          label={match.homeTeam.shortName || match.homeTeam.tla || 'Home'}
          value={homeGoals}
          disabled={disabled}
          onChange={setHomeGoals}
        />
        <Typography variant="h6" component="span" sx={{ pb: 0.5 }} aria-hidden>
          –
        </Typography>
        <GoalStepper
          label={match.awayTeam.shortName || match.awayTeam.tla || 'Away'}
          value={awayGoals}
          disabled={disabled}
          onChange={setAwayGoals}
        />
      </Box>

      <Button
        variant="contained"
        color="primary"
        size="small"
        disabled={disabled}
        onClick={handleSubmit}
        sx={{ alignSelf: 'center' }}
      >
        {existing ? 'Update prediction' : 'Save prediction'}
      </Button>

      <Snackbar
        open={snack !== null}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">
            {snack.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

export default PredictionInput
