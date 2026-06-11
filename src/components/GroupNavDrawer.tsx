/**
 * GroupNavDrawer — hamburger button + left navigation drawer unifying group
 * SELECT / CREATE / JOIN (ticket 030, Canvas variant A; replaces the 029 GroupSwitcher).
 *
 * The hamburger sits at the far left of the app bar (AppShell's `leadingControl` slot)
 * and opens a temporary Drawer listing the groups the signed-in user can enter
 * (owned ∪ approved memberships, deduped, sorted) with avatar initial, name and role;
 * the current group is selected/checked. Picking another navigates to it on the SAME
 * tab. Below a divider: "Create group" (→ /groups/new) and "Join with code" (→ the
 * shared JoinGroupDialog). A filter field appears at ≥ SEARCH_THRESHOLD groups.
 *
 * Read-only: it only navigates. The drawer paper echoes the app bar's translucent
 * blur using theme tokens only (alpha of `background.paper` + blur).
 */
import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import IconButton from '@mui/material/IconButton'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import { alpha } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import AddIcon from '@mui/icons-material/Add'
import TagIcon from '@mui/icons-material/Tag'
import CheckIcon from '@mui/icons-material/Check'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { useGroup } from '../group/useGroup'
import { useMyGroups } from '../hooks/useMyGroups'
import { JoinGroupDialog } from './JoinGroupDialog'
import type { Group, MemberRole } from '../shared/types'

/** Show the in-drawer filter field once the user has at least this many groups. */
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

function initial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed[0].toUpperCase() : '?'
}

export function GroupNavDrawer() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { gid } = useGroup()
  const { owned, approved } = useMyGroups()
  const navigate = useNavigate()
  const location = useLocation()

  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [joinOpen, setJoinOpen] = useState(false)

  // Keep the viewer on the same tab when switching groups (route guards redirect
  // Admin/Canvas to fixtures if the target group doesn't expose them).
  const currentTab = location.pathname.split('/').filter(Boolean)[2] ?? 'fixtures'

  const groups = useMemo(() => enterableGroups(owned, approved), [owned, approved])
  // gid → the viewer's member-doc role, for the secondary line on joined groups.
  const rolesById = useMemo(() => {
    const map = new Map<string, MemberRole>()
    for (const a of approved) map.set(a.group.groupId, a.member.role ?? 'member')
    return map
  }, [approved])

  const showSearch = groups.length >= SEARCH_THRESHOLD
  const shown = showSearch
    ? groups.filter((g) => g.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : groups

  const roleLabel = (g: Group): string => {
    if (user && g.ownerUid === user.uid) return t('common.owner')
    return rolesById.get(g.groupId) === 'admin' ? t('common.admin') : t('common.member')
  }

  const close = () => {
    setOpen(false)
    setFilter('')
  }

  const handlePick = (g: Group) => {
    close()
    if (g.groupId !== gid) navigate(`/g/${g.groupId}/${currentTab}`)
  }

  return (
    <>
      <IconButton
        edge="start"
        color="inherit"
        aria-label={t('groupNav.openMenu')}
        onClick={() => setOpen(true)}
        sx={{ mr: 1 }}
      >
        <MenuIcon />
      </IconButton>

      <Drawer
        anchor="left"
        open={open}
        onClose={close}
        slotProps={{
          paper: {
            sx: (theme) => ({
              width: 300,
              maxWidth: '85vw',
              display: 'flex',
              flexDirection: 'column',
              // Echo the app bar's translucent-blur treatment (theme tokens only).
              backgroundColor: alpha(theme.palette.background.paper, 0.85),
              backgroundImage: 'none',
              backdropFilter: 'blur(8px)',
              borderRight: `1px solid ${theme.palette.divider}`,
            }),
          },
        }}
      >
        <List
          sx={{ flex: 1, overflowY: 'auto' }}
          aria-label={t('groupNav.yourGroups')}
          subheader={
            <ListSubheader component="div" sx={{ bgcolor: 'transparent' }}>
              {t('groupNav.yourGroups')}
            </ListSubheader>
          }
        >
          {showSearch && (
            <ListItem sx={{ py: 1 }}>
              <TextField
                size="small"
                fullWidth
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('groupNav.searchPlaceholder')}
                slotProps={{ htmlInput: { 'aria-label': t('groupNav.searchPlaceholder') } }}
              />
            </ListItem>
          )}

          {shown.map((g) => {
            const selected = g.groupId === gid
            return (
              <ListItemButton
                key={g.groupId}
                selected={selected}
                aria-current={selected ? 'true' : undefined}
                onClick={() => handlePick(g)}
              >
                <ListItemAvatar sx={{ minWidth: 44 }}>
                  <Avatar
                    aria-hidden
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: selected ? 'primary.main' : 'action.hover',
                    }}
                  >
                    {initial(g.name)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={g.name}
                  secondary={roleLabel(g)}
                  slotProps={{ primary: { sx: { fontWeight: selected ? 700 : 500 } } }}
                />
                {selected && <CheckIcon fontSize="small" color="primary" aria-hidden />}
              </ListItemButton>
            )
          })}

          {showSearch && shown.length === 0 && (
            <ListItem>
              <ListItemText secondary={t('groupNav.noMatches')} />
            </ListItem>
          )}
        </List>

        <Divider />

        <List dense>
          <ListItemButton
            onClick={() => {
              close()
              navigate('/groups/new')
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <AddIcon />
            </ListItemIcon>
            <ListItemText primary={t('groupNav.createGroup')} />
          </ListItemButton>
          <ListItemButton
            onClick={() => {
              close()
              setJoinOpen(true)
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <TagIcon />
            </ListItemIcon>
            <ListItemText primary={t('groupNav.joinWithCode')} />
          </ListItemButton>
        </List>
      </Drawer>

      <JoinGroupDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  )
}

export default GroupNavDrawer
