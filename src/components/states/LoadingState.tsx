import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

export interface LoadingStateProps {
  /** Number of skeleton rows to render. */
  rows?: number
  /** Accessible label announced to assistive tech while content loads. */
  label?: string
}

/**
 * Reusable loading placeholder built from MD3-styled skeletons.
 * Pages render this while data is being fetched.
 */
export function LoadingState({ rows = 3, label = 'Loading' }: LoadingStateProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      sx={{ width: '100%' }}
    >
      <Stack spacing={2}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            height={72}
            animation="wave"
            sx={{ borderRadius: 3 }}
          />
        ))}
      </Stack>
    </Box>
  )
}

export default LoadingState
