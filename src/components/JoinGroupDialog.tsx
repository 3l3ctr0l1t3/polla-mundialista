/**
 * JoinGroupDialog — paste an invite link (or raw group id) to join a group (ticket 030,
 * extracted from MyGroupsPage so the hamburger group drawer can reuse it).
 *
 * Controlled by the parent (`open`/`onClose`). On a valid input it closes itself and
 * navigates to `/join/{gid}` where the regular join-request flow takes over.
 */
import { useState } from 'react'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** Parse a pasted invite link or raw id into a group id; '' if none found. */
function parseGid(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  // Accept a full /join/:gid URL or path, or a bare id.
  const match = trimmed.match(/join\/([^/?#]+)/)
  return match ? match[1] : trimmed
}

export interface JoinGroupDialogProps {
  open: boolean
  onClose: () => void
}

export function JoinGroupDialog({ open, onClose }: JoinGroupDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [input, setInput] = useState('')

  const handleJoin = () => {
    const gid = parseGid(input)
    if (!gid) return
    setInput('')
    onClose()
    navigate(`/join/${gid}`)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('groups.joinDialogTitle')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label={t('groups.inviteOrId')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleJoin()
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleJoin} disabled={!parseGid(input)}>
          {t('common.continue')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default JoinGroupDialog
