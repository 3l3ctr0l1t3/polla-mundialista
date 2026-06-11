/**
 * GroupNavPreviews — Canvas-only mockups for the group SELECT / CREATE / JOIN navigation
 * (candidate replacements for the current top-bar GroupSwitcher, ticket 029).
 *
 * Three interactive variants, each inside a fake phone frame with a fake app bar:
 *   A) Hamburger → left navigation drawer (groups list + create/join actions)
 *   B) Title menu — the current switcher enriched with avatars, roles and
 *      create/join actions appended to the menu
 *   C) Title → bottom sheet (mobile-first large touch rows + big action buttons)
 *
 * PRESENTATIONAL ONLY: sample data, no Firestore, no routing. When a winner is chosen,
 * port it to a real component (AppShell / GroupSwitcher) under its own ticket.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import { alpha } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import AddIcon from '@mui/icons-material/Add'
import TagIcon from '@mui/icons-material/Tag'
import CheckIcon from '@mui/icons-material/Check'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

interface SampleGroup {
  id: string
  name: string
  role: 'Owner' | 'Admin' | 'Member'
  members: number
}

const SAMPLE_GROUPS: SampleGroup[] = [
  { id: 'g1', name: 'La Pollita CORP', role: 'Owner', members: 14 },
  { id: 'g2', name: 'Familia Pérez', role: 'Member', members: 9 },
  { id: 'g3', name: 'Oficina Bogotá', role: 'Admin', members: 23 },
  { id: 'g4', name: 'Parceros FC', role: 'Member', members: 6 },
]

const FRAME_WIDTH = 390
const FRAME_HEIGHT = 620
const BAR_HEIGHT = 56

function initial(name: string): string {
  return name.trim() ? name.trim()[0].toUpperCase() : '?'
}

/** Two skeleton fixture-ish cards so the overlays are judged over real-feeling content. */
function BodyPlaceholder() {
  return (
    <Stack spacing={1.5} sx={{ p: 1.5 }}>
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardContent>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Stack sx={{ flex: 1, alignItems: 'center' }} spacing={0.5}>
                <Skeleton width={64} />
                <Skeleton variant="circular" width={32} height={32} />
              </Stack>
              <Skeleton width={48} height={40} />
              <Stack sx={{ flex: 1, alignItems: 'center' }} spacing={0.5}>
                <Skeleton width={64} />
                <Skeleton variant="circular" width={32} height={32} />
              </Stack>
            </Stack>
            <Stack sx={{ alignItems: 'center', mt: 1 }}>
              <Skeleton width={120} height={32} />
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}

/** The fake phone: relative frame + fake app bar; overlays render inside it. */
function PhoneFrame({ bar, overlay }: { bar: React.ReactNode; overlay?: React.ReactNode }) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: FRAME_WIDTH,
        maxWidth: '100%',
        height: FRAME_HEIGHT,
        overflow: 'hidden',
        borderRadius: 3,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          height: BAR_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {bar}
      </Box>
      <BodyPlaceholder />
      {overlay}
    </Box>
  )
}

/** Dim backdrop confined to the frame. */
function FrameBackdrop({ onClick }: { onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'absolute',
        inset: 0,
        bgcolor: (theme) => alpha(theme.palette.common.black, 0.5),
        zIndex: 2,
      }}
    />
  )
}

/** One group row, shared by the drawer and the bottom sheet. */
function GroupRow({
  g,
  current,
  dense,
  onClick,
}: {
  g: SampleGroup
  current: boolean
  dense?: boolean
  onClick: () => void
}) {
  return (
    <ListItemButton selected={current} onClick={onClick} sx={{ py: dense ? 0.5 : 1 }}>
      <ListItemAvatar sx={{ minWidth: 44 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: current ? 'primary.main' : 'action.hover' }}>
          {initial(g.name)}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={g.name}
        secondary={`${g.members} members · ${g.role}`}
        slotProps={{ primary: { sx: { fontWeight: current ? 700 : 500 } } }}
      />
      {current && <CheckIcon fontSize="small" color="primary" />}
    </ListItemButton>
  )
}

// ---------------------------------------------------------------------------
// A) Hamburger → left navigation drawer
// ---------------------------------------------------------------------------
export function HamburgerDrawerPreview() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('g1')
  const currentGroup = SAMPLE_GROUPS.find((g) => g.id === current) ?? SAMPLE_GROUPS[0]

  return (
    <PhoneFrame
      bar={
        <>
          <IconButton aria-label="open groups menu" onClick={() => setOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
            {currentGroup.name}
          </Typography>
        </>
      }
      overlay={
        open ? (
          <>
            <FrameBackdrop onClick={() => setOpen(false)} />
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: 280,
                bgcolor: 'background.paper',
                boxShadow: 8,
                zIndex: 3,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <List
                sx={{ flex: 1, overflowY: 'auto' }}
                subheader={
                  <ListSubheader component="div" sx={{ bgcolor: 'transparent' }}>
                    Your groups
                  </ListSubheader>
                }
              >
                {SAMPLE_GROUPS.map((g) => (
                  <GroupRow
                    key={g.id}
                    g={g}
                    current={g.id === current}
                    onClick={() => {
                      setCurrent(g.id)
                      setOpen(false)
                    }}
                  />
                ))}
              </List>
              <Divider />
              <List dense>
                <ListItemButton onClick={() => setOpen(false)}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <AddIcon />
                  </ListItemIcon>
                  <ListItemText primary="Create group" />
                </ListItemButton>
                <ListItemButton onClick={() => setOpen(false)}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <TagIcon />
                  </ListItemIcon>
                  <ListItemText primary="Join with code" />
                </ListItemButton>
              </List>
            </Box>
          </>
        ) : undefined
      }
    />
  )
}

// ---------------------------------------------------------------------------
// B) Title menu — current switcher enriched with avatars/roles + actions
// ---------------------------------------------------------------------------
export function TitleMenuPreview() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [current, setCurrent] = useState('g1')
  const currentGroup = SAMPLE_GROUPS.find((g) => g.id === current) ?? SAMPLE_GROUPS[0]
  const open = Boolean(anchorEl)

  return (
    <PhoneFrame
      bar={
        <>
          <Button
            color="inherit"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            endIcon={<ArrowDropDownIcon />}
            sx={{ textTransform: 'none', minWidth: 0, px: 1 }}
          >
            <Typography variant="h6" component="span" noWrap sx={{ minWidth: 0 }}>
              {currentGroup.name}
            </Typography>
          </Button>
          <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
            {SAMPLE_GROUPS.map((g) => {
              const selected = g.id === current
              return (
                <MenuItem
                  key={g.id}
                  selected={selected}
                  onClick={() => {
                    setCurrent(g.id)
                    setAnchorEl(null)
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor: selected ? 'primary.main' : 'action.hover',
                        fontSize: '0.85rem',
                      }}
                    >
                      {initial(g.name)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={g.name} secondary={g.role} />
                  {selected && <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} />}
                </MenuItem>
              )
            })}
            <Divider />
            <MenuItem onClick={() => setAnchorEl(null)}>
              <ListItemIcon>
                <AddIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Create group" />
            </MenuItem>
            <MenuItem onClick={() => setAnchorEl(null)}>
              <ListItemIcon>
                <TagIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Join with code" />
            </MenuItem>
          </Menu>
        </>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// C) Title → bottom sheet (mobile-first)
// ---------------------------------------------------------------------------
export function BottomSheetPreview() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('g1')
  const currentGroup = SAMPLE_GROUPS.find((g) => g.id === current) ?? SAMPLE_GROUPS[0]

  return (
    <PhoneFrame
      bar={
        <Button
          color="inherit"
          onClick={() => setOpen(true)}
          endIcon={<ArrowDropDownIcon />}
          sx={{ textTransform: 'none', minWidth: 0, px: 1 }}
        >
          <Avatar
            sx={{
              width: 28,
              height: 28,
              mr: 1,
              bgcolor: 'primary.main',
              fontSize: '0.85rem',
            }}
          >
            {initial(currentGroup.name)}
          </Avatar>
          <Typography variant="h6" component="span" noWrap sx={{ minWidth: 0 }}>
            {currentGroup.name}
          </Typography>
        </Button>
      }
      overlay={
        open ? (
          <>
            <FrameBackdrop onClick={() => setOpen(false)} />
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'background.paper',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                boxShadow: 8,
                zIndex: 3,
                pb: 2,
              }}
            >
              {/* Grabber */}
              <Box
                sx={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'divider',
                  mx: 'auto',
                  mt: 1,
                  mb: 0.5,
                }}
              />
              <Typography variant="subtitle2" color="text.secondary" sx={{ px: 2, py: 0.5 }}>
                Your groups
              </Typography>
              <List sx={{ maxHeight: 280, overflowY: 'auto' }}>
                {SAMPLE_GROUPS.map((g) => (
                  <GroupRow
                    key={g.id}
                    g={g}
                    current={g.id === current}
                    onClick={() => {
                      setCurrent(g.id)
                      setOpen(false)
                    }}
                  />
                ))}
              </List>
              <Stack direction="row" spacing={1.5} sx={{ px: 2, pt: 1 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setOpen(false)}
                >
                  Create group
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<TagIcon />}
                  onClick={() => setOpen(false)}
                >
                  Join with code
                </Button>
              </Stack>
            </Box>
          </>
        ) : undefined
      }
    />
  )
}
