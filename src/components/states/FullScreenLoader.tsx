import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useTranslation } from 'react-i18next'

export interface FullScreenLoaderProps {
  /** Accessible label announced to assistive tech while the app resolves. */
  label?: string
}

/**
 * Full-screen centered circular spinner (ticket 031) — the app-level loading screen
 * shown while auth / the group context resolve. Page-level LIST placeholders keep
 * using `LoadingState` skeletons; this is only for whole-screen gates.
 */
export function FullScreenLoader({ label }: FullScreenLoaderProps) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('states.loading')
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={resolvedLabel}
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <CircularProgress aria-hidden />
    </Box>
  )
}

export default FullScreenLoader
