/**
 * CountdownToKickoff — a live, server-time-driven countdown to a match kickoff.
 *
 * Ticks every second off `now()` (a server-corrected clock from `useServerTime`) so a
 * skewed device clock cannot make a match appear open when the server considers it locked.
 * Once kickoff has passed it renders a "Locked" chip instead of a countdown.
 *
 * Colors/shape come from the MUI theme — no hard-coded values.
 */
import { useEffect, useState } from 'react'
import Chip from '@mui/material/Chip'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LockIcon from '@mui/icons-material/Lock'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

export interface CountdownToKickoffProps {
  /** Kickoff time in milliseconds since the Unix epoch. */
  kickoffMs: number
  /** Server-corrected current time in ms. */
  now: () => number
}

function formatRemaining(ms: number, t: TFunction): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return t('match.daysHoursMinutes', { days, hours, minutes })
  if (hours > 0) return t('match.hoursMinutesSeconds', { hours, minutes, seconds })
  if (minutes > 0) return t('match.minutesSeconds', { minutes, seconds })
  return t('match.seconds', { seconds })
}

export function CountdownToKickoff({ kickoffMs, now }: CountdownToKickoffProps) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(() => kickoffMs - now())

  useEffect(() => {
    setRemaining(kickoffMs - now())
    const id = setInterval(() => {
      setRemaining(kickoffMs - now())
    }, 1000)
    return () => clearInterval(id)
  }, [kickoffMs, now])

  const locked = remaining <= 0

  if (locked) {
    return (
      <Chip
        icon={<LockIcon />}
        label={t('match.locked')}
        size="small"
        color="default"
        variant="outlined"
        aria-label={t('match.lockedAria')}
      />
    )
  }

  const remainingLabel = formatRemaining(remaining, t)

  return (
    <Chip
      icon={<AccessTimeIcon />}
      label={t('match.locksIn', { remaining: remainingLabel })}
      size="small"
      color="secondary"
      variant="outlined"
      aria-label={t('match.locksInAria', { remaining: remainingLabel })}
    />
  )
}

export default CountdownToKickoff
