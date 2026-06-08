/* eslint-disable react-refresh/only-export-components -- dev sandbox: variant components + registry live together on purpose */
/**
 * Score-input options for the Canvas sandbox (dev/superadmin only).
 *
 * Seven different widgets for "what goes between the flags" on the fixture card. Each is
 * self-contained and presentational (own local state, no Firestore). Exported only as the
 * `SCORE_INPUT_OPTIONS` registry so CanvasPage can render them between two flags to compare.
 */
import { useState } from 'react'
import type { ComponentType } from 'react'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import ButtonBase from '@mui/material/ButtonBase'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

const clamp = (n: number): number =>
  Math.max(0, Math.min(20, Math.floor(Number.isFinite(n) ? n : 0)))

/** Local home/away score state shared by every option. */
function useScore() {
  const [home, setHome] = useState(0)
  const [away, setAway] = useState(0)
  return {
    home,
    away,
    setHome: (n: number) => setHome(clamp(n)),
    setAway: (n: number) => setAway(clamp(n)),
  }
}

function Versus() {
  return (
    <Typography variant="caption" sx={{ px: 0.5, color: 'text.secondary', fontStyle: 'italic' }}>
      vs
    </Typography>
  )
}

const bigNum = {
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
  fontSize: '1.4rem',
  lineHeight: 1,
}

/** 1 — Horizontal steppers: [−] n [+] (today's production widget). */
function SteppersOption() {
  const { home, away, setHome, setAway } = useScore()
  const cell = (v: number, set: (n: number) => void, side: string) => (
    <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
      <IconButton
        size="small"
        disabled={v <= 0}
        aria-label={`decrease ${side}`}
        onClick={() => set(v - 1)}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ ...bigNum, minWidth: 22, textAlign: 'center' }}>{v}</Typography>
      <IconButton size="small" aria-label={`increase ${side}`} onClick={() => set(v + 1)}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      {cell(home, setHome, 'home')}
      <Versus />
      {cell(away, setAway, 'away')}
    </Stack>
  )
}

/** 2 — Vertical spinner: chevron-up / number / chevron-down. */
function SpinnerOption() {
  const { home, away, setHome, setAway } = useScore()
  const cell = (v: number, set: (n: number) => void, side: string) => (
    <Stack sx={{ alignItems: 'center' }}>
      <IconButton size="small" aria-label={`increase ${side}`} onClick={() => set(v + 1)}>
        <KeyboardArrowUpIcon fontSize="small" />
      </IconButton>
      <Typography sx={bigNum}>{v}</Typography>
      <IconButton
        size="small"
        disabled={v <= 0}
        aria-label={`decrease ${side}`}
        onClick={() => set(v - 1)}
      >
        <KeyboardArrowDownIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      {cell(home, setHome, 'home')}
      <Versus />
      {cell(away, setAway, 'away')}
    </Stack>
  )
}

/** 3 — Number fields. */
function FieldsOption() {
  const { home, away, setHome, setAway } = useScore()
  const field = (v: number, set: (n: number) => void, side: string) => (
    <TextField
      type="number"
      value={v}
      onChange={(e) => set(Number(e.target.value))}
      size="small"
      slotProps={{
        htmlInput: { min: 0, 'aria-label': side, style: { textAlign: 'center', width: '2.5ch' } },
      }}
      sx={{ width: 64 }}
    />
  )
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      {field(home, setHome, 'home')}
      <Versus />
      {field(away, setAway, 'away')}
    </Stack>
  )
}

/** 4 — Dropdowns (0–9). */
function SelectOption() {
  const { home, away, setHome, setAway } = useScore()
  const sel = (v: number, set: (n: number) => void, side: string) => (
    <Select size="small" value={v} onChange={(e) => set(Number(e.target.value))} aria-label={side}>
      {Array.from({ length: 10 }, (_, i) => (
        <MenuItem key={i} value={i}>
          {i}
        </MenuItem>
      ))}
    </Select>
  )
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      {sel(home, setHome, 'home')}
      <Versus />
      {sel(away, setAway, 'away')}
    </Stack>
  )
}

/** 5 — Score chips (toggle 0–5 per team, stacked). */
function ChipsOption() {
  const { home, away, setHome, setAway } = useScore()
  const grp = (v: number, set: (n: number) => void, side: string) => (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={v}
      onChange={(_, n: number | null) => n != null && set(n)}
      aria-label={side}
    >
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <ToggleButton key={n} value={n} sx={{ px: 1, py: 0.25 }}>
          {n}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
  return (
    <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
      {grp(home, setHome, 'home')}
      {grp(away, setAway, 'away')}
    </Stack>
  )
}

/** 6 — Sliders (0–10 per team, stacked). */
function SlidersOption() {
  const { home, away, setHome, setAway } = useScore()
  const row = (v: number, set: (n: number) => void, side: string) => (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: 170 }}>
      <Typography sx={{ ...bigNum, width: 18, textAlign: 'right' }}>{v}</Typography>
      <Slider
        size="small"
        value={v}
        min={0}
        max={10}
        aria-label={side}
        onChange={(_, n) => set(n as number)}
      />
    </Stack>
  )
  return (
    <Stack spacing={0.5}>
      {row(home, setHome, 'home')}
      {row(away, setAway, 'away')}
    </Stack>
  )
}

/** 7 — Tap-to-add: tap a number to +1, wraps to 0 after 9. */
function TapOption() {
  const { home, away, setHome, setAway } = useScore()
  const num = (v: number, set: (n: number) => void, side: string) => (
    <ButtonBase
      onClick={() => set(v >= 9 ? 0 : v + 1)}
      aria-label={`${side} ${v}, tap to increase`}
      sx={{ borderRadius: 2, px: 1.75, py: 0.5, border: 1, borderColor: 'divider' }}
    >
      <Typography sx={{ ...bigNum, fontSize: '1.6rem' }}>{v}</Typography>
    </ButtonBase>
  )
  return (
    <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {num(home, setHome, 'home')}
        <Versus />
        {num(away, setAway, 'away')}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        tap to add · wraps after 9
      </Typography>
    </Stack>
  )
}

export interface ScoreInputOption {
  id: string
  label: string
  Component: ComponentType
}

export const SCORE_INPUT_OPTIONS: ScoreInputOption[] = [
  { id: 'steppers', label: '1 · Steppers (− n +)', Component: SteppersOption },
  { id: 'spinner', label: '2 · Spinner (▲ n ▼)', Component: SpinnerOption },
  { id: 'fields', label: '3 · Number fields', Component: FieldsOption },
  { id: 'select', label: '4 · Dropdowns', Component: SelectOption },
  { id: 'chips', label: '5 · Score chips', Component: ChipsOption },
  { id: 'sliders', label: '6 · Sliders', Component: SlidersOption },
  { id: 'tap', label: '7 · Tap to add', Component: TapOption },
]
