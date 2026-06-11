/**
 * GroupSwitcher — the app-bar title turned into a group picker (ticket 029).
 *
 * Shows the CURRENT group's name as a button in the top app bar; clicking it opens a
 * menu of the groups the signed-in user can enter (owned ∪ approved memberships, deduped),
 * with the current one checked. Picking another navigates to it, keeping the same tab.
 * When the user belongs to many groups (≥ SEARCH_THRESHOLD) a filter field appears.
 *
 * Read-only: it only navigates. Pending (not-yet-approved) groups are excluded — you
 * can't enter them. Falls back gracefully while `useMyGroups` loads.
 */
import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CheckIcon from '@mui/icons-material/Check'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { useTranslation } from 'react-i18next'
import { useGroup } from '../group/useGroup'
import { useMyGroups } from '../hooks/useMyGroups'
import type { Group } from '../shared/types'

/** Show the in-menu filter field once the user has at least this many groups. */
const SEARCH_THRESHOLD = 8

/** Owned ∪ approved groups the user can enter, deduped by id and sorted by name. */
function enterableGroups(owned: Group[], approved: { group: Group }[]): Group[] {
  const byId = new Map<string, Group>()
  for (const g of owned) byId.set(g.groupId, g)
  for (const a of approved) byId.set(a.group.groupId, a.group)
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
}

export function GroupSwitcher() {
  const { t } = useTranslation()
  const { gid, group } = useGroup()
  const { owned, approved } = useMyGroups()
  const navigate = useNavigate()
  const location = useLocation()

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [filter, setFilter] = useState('')
  const open = Boolean(anchorEl)

  // Keep the viewer on the same tab when switching groups (route guards redirect
  // Admin/Canvas to fixtures if the target group doesn't expose them).
  const currentTab = location.pathname.split('/').filter(Boolean)[2] ?? 'fixtures'

  const groups = useMemo(() => enterableGroups(owned, approved), [owned, approved])
  const showSearch = groups.length >= SEARCH_THRESHOLD
  const shown = showSearch
    ? groups.filter((g) => g.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : groups

  const currentName = group?.name ?? ''

  const close = () => {
    setAnchorEl(null)
    setFilter('')
  }

  const handlePick = (g: Group) => {
    close()
    if (g.groupId !== gid) navigate(`/g/${g.groupId}/${currentTab}`)
  }

  return (
    <>
      <Button
        color="inherit"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'group-switcher-menu' : undefined}
        aria-label={t('groupSwitcher.trigger', { name: currentName })}
        endIcon={<ArrowDropDownIcon />}
        sx={{ textTransform: 'none', maxWidth: '100%', minWidth: 0, px: 1 }}
      >
        <Typography variant="h6" component="span" noWrap sx={{ minWidth: 0 }}>
          {currentName}
        </Typography>
      </Button>

      <Menu
        id="group-switcher-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        slotProps={{ list: { dense: true, 'aria-label': t('groupSwitcher.menuLabel') } }}
      >
        {showSearch && (
          <Box sx={{ px: 1.5, py: 1 }} onKeyDown={(e) => e.stopPropagation()}>
            <TextField
              size="small"
              autoFocus
              fullWidth
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder={t('groupSwitcher.searchPlaceholder')}
              slotProps={{ htmlInput: { 'aria-label': t('groupSwitcher.searchPlaceholder') } }}
            />
          </Box>
        )}

        {shown.map((g) => {
          const selected = g.groupId === gid
          return (
            <MenuItem
              key={g.groupId}
              selected={selected}
              aria-current={selected ? 'true' : undefined}
              onClick={() => handlePick(g)}
            >
              <ListItemIcon>{selected && <CheckIcon fontSize="small" />}</ListItemIcon>
              <ListItemText>{g.name}</ListItemText>
            </MenuItem>
          )
        })}

        {showSearch && shown.length === 0 && (
          <MenuItem disabled>
            <ListItemText>{t('groupSwitcher.noMatches')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  )
}

export default GroupSwitcher
