import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import InboxIcon from '@mui/icons-material/Inbox'

export interface EmptyStateProps {
  /** Primary message, e.g. "No predictions yet". */
  title: string
  /** Optional supporting line. */
  description?: string
  /** Optional icon; defaults to an inbox glyph. */
  icon?: ReactNode
  /** Optional action element (e.g. a button). */
  action?: ReactNode
}

/**
 * Reusable empty-state placeholder. Colors come from the theme palette
 * (text.secondary), never hard-coded.
 */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 1.5,
        py: 6,
        px: 2,
        color: 'text.secondary',
      }}
    >
      <Box aria-hidden sx={{ fontSize: 48, lineHeight: 0, color: 'text.disabled' }}>
        {icon ?? <InboxIcon fontSize="inherit" />}
      </Box>
      <Typography variant="h6" component="p" color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  )
}

export default EmptyState
