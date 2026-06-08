import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ErrorIcon from '@mui/icons-material/Error'
import { useTranslation } from 'react-i18next'

export interface ErrorStateProps {
  /** Headline shown to the user. */
  title?: string
  /** Supporting detail; can be an error message. */
  description?: string
  /** When provided, renders a retry button that calls this handler. */
  onRetry?: () => void
  /** Label for the retry button. */
  retryLabel?: string
}

/**
 * Reusable error placeholder. Uses the theme `error` palette so it adapts to
 * light/dark and any future rebrand.
 */
export function ErrorState({ title, description, onRetry, retryLabel }: ErrorStateProps) {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t('errors.genericTitle')
  const resolvedDescription = description ?? t('errors.genericDescription')
  const resolvedRetryLabel = retryLabel ?? t('errors.retry')
  return (
    <Box
      role="alert"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 1.5,
        py: 6,
        px: 2,
      }}
    >
      <ErrorIcon aria-hidden sx={{ fontSize: 48, color: 'error.main' }} />
      <Typography variant="h6" component="p" color="text.primary">
        {resolvedTitle}
      </Typography>
      {resolvedDescription && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {resolvedDescription}
        </Typography>
      )}
      {onRetry && (
        <Button variant="outlined" color="primary" onClick={onRetry} sx={{ mt: 1 }}>
          {resolvedRetryLabel}
        </Button>
      )}
    </Box>
  )
}

export default ErrorState
