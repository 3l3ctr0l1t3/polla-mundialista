/**
 * GroupNavDrawer tests (ticket 030, spec rules 1–3 + 6).
 *
 * Mocks useGroup/useMyGroups/useAuth and the router (like the former
 * GroupSwitcher.test.tsx) so the drawer is exercised in isolation.
 */
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { Group, Member } from '../shared/types'

// --- mocks -----------------------------------------------------------------

const useGroupMock = vi.fn<() => { gid: string; group: Group | null }>()
vi.mock('../group/useGroup', () => ({ useGroup: () => useGroupMock() }))

const useMyGroupsMock = vi.fn()
vi.mock('../hooks/useMyGroups', () => ({ useMyGroups: () => useMyGroupsMock() }))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'me' }, loading: false, isSuperAdmin: false }),
}))

const navigateMock = vi.fn()
const locationMock = { pathname: '/g/g1/leaderboard' }
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => locationMock,
}))

import { GroupNavDrawer } from './GroupNavDrawer'

// --- fixtures --------------------------------------------------------------

function grp(id: string, name: string, ownerUid = 'other'): Group {
  return {
    groupId: id,
    name,
    ownerUid,
    ownerName: 'Owner',
    ownerPhotoURL: null,
  } as Group
}

function joined(g: Group, role: 'admin' | 'member' = 'member') {
  return {
    group: g,
    member: {
      uid: 'me',
      displayName: 'Me',
      email: 'me@x.com',
      photoURL: null,
      role,
      status: 'approved',
      requestedAt: {} as Member['requestedAt'],
      decidedAt: null,
      decidedBy: null,
    } as Member,
  }
}

function renderDrawer() {
  return render(
    <ThemeProvider theme={theme}>
      <GroupNavDrawer />
    </ThemeProvider>,
  )
}

const openDrawer = () => fireEvent.click(screen.getByRole('button', { name: /open group menu/i }))
const getGroupList = () => screen.getByRole('list', { name: /your groups/i })
const queryGroupList = () => screen.queryByRole('list', { name: /your groups/i })

beforeEach(() => {
  navigateMock.mockClear()
  useGroupMock.mockReturnValue({ gid: 'g1', group: grp('g1', 'Alpha', 'me') })
  useMyGroupsMock.mockReturnValue({
    owned: [grp('g1', 'Alpha', 'me')],
    approved: [joined(grp('g2', 'Bravo')), joined(grp('g3', 'Charlie'), 'admin')],
    pending: [],
    loading: false,
    error: null,
  })
})

describe('GroupNavDrawer', () => {
  // --- rule 1: hamburger opens; Esc/backdrop close --------------------------
  it('shows an accessible hamburger button that opens the drawer', () => {
    renderDrawer()
    expect(queryGroupList()).not.toBeInTheDocument()
    openDrawer()
    expect(getGroupList()).toBeInTheDocument()
  })

  it('closes the drawer on Escape', async () => {
    renderDrawer()
    openDrawer()
    fireEvent.keyDown(getGroupList(), { key: 'Escape' })
    await waitFor(() => expect(queryGroupList()).not.toBeInTheDocument())
  })

  it('closes the drawer on backdrop click', async () => {
    renderDrawer()
    openDrawer()
    const backdrop = document.querySelector('.MuiBackdrop-root')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop as Element)
    await waitFor(() => expect(queryGroupList()).not.toBeInTheDocument())
  })

  // --- rule 2: enterable groups, deduped/sorted, current checked ------------
  it('lists the enterable groups with the current one selected', () => {
    renderDrawer()
    openDrawer()
    const list = getGroupList()
    const alpha = within(list).getByRole('button', { name: /alpha/i })
    expect(alpha).toHaveAttribute('aria-current', 'true')
    expect(within(list).getByRole('button', { name: /bravo/i })).not.toHaveAttribute('aria-current')
    expect(within(list).getByRole('button', { name: /charlie/i })).toBeInTheDocument()
  })

  it('shows the viewer role per group (Owner / Admin / Member)', () => {
    renderDrawer()
    openDrawer()
    const list = getGroupList()
    expect(
      within(within(list).getByRole('button', { name: /alpha/i })).getByText('Owner'),
    ).toBeInTheDocument()
    expect(
      within(within(list).getByRole('button', { name: /bravo/i })).getByText('Member'),
    ).toBeInTheDocument()
    expect(
      within(within(list).getByRole('button', { name: /charlie/i })).getByText('Admin'),
    ).toBeInTheDocument()
  })

  it('dedupes a group that is both owned and an approved membership', () => {
    useMyGroupsMock.mockReturnValue({
      owned: [grp('g1', 'Alpha', 'me')],
      approved: [joined(grp('g1', 'Alpha', 'me')), joined(grp('g2', 'Bravo'))],
      pending: [],
      loading: false,
      error: null,
    })
    renderDrawer()
    openDrawer()
    expect(within(getGroupList()).getAllByRole('button', { name: /alpha/i })).toHaveLength(1)
  })

  it('excludes pending groups', () => {
    useMyGroupsMock.mockReturnValue({
      owned: [grp('g1', 'Alpha', 'me')],
      approved: [joined(grp('g2', 'Bravo'))],
      pending: [joined(grp('g9', 'PendingPool'))],
      loading: false,
      error: null,
    })
    renderDrawer()
    openDrawer()
    expect(
      within(getGroupList()).queryByRole('button', { name: /pendingpool/i }),
    ).not.toBeInTheDocument()
  })

  it('navigates to the picked group on the SAME tab and closes', async () => {
    renderDrawer()
    openDrawer()
    fireEvent.click(within(getGroupList()).getByRole('button', { name: /bravo/i }))
    expect(navigateMock).toHaveBeenCalledWith('/g/g2/leaderboard')
    await waitFor(() => expect(queryGroupList()).not.toBeInTheDocument())
  })

  it('does NOT navigate when picking the current group (just closes)', async () => {
    renderDrawer()
    openDrawer()
    fireEvent.click(within(getGroupList()).getByRole('button', { name: /alpha/i }))
    expect(navigateMock).not.toHaveBeenCalled()
    await waitFor(() => expect(queryGroupList()).not.toBeInTheDocument())
  })

  // --- rule 3: create + join actions ----------------------------------------
  it('"Create group" navigates to /groups/new', () => {
    renderDrawer()
    openDrawer()
    fireEvent.click(screen.getByRole('button', { name: /create group/i }))
    expect(navigateMock).toHaveBeenCalledWith('/groups/new')
  })

  it('"Join with code" opens the join dialog; a valid link navigates to /join/{gid}', async () => {
    renderDrawer()
    openDrawer()
    fireEvent.click(screen.getByRole('button', { name: /join with code/i }))
    const dialog = await screen.findByRole('dialog', { name: /join via link/i })

    const input = within(dialog).getByLabelText(/invite link or group id/i)
    fireEvent.change(input, { target: { value: 'https://example.app/join/abc123' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /continue/i }))
    expect(navigateMock).toHaveBeenCalledWith('/join/abc123')
  })

  // --- rule 6: filter at >= 8 groups ----------------------------------------
  it('shows NO filter field for a short group list', () => {
    renderDrawer()
    openDrawer()
    expect(screen.queryByPlaceholderText(/search groups/i)).not.toBeInTheDocument()
  })

  it('shows a filter for many groups, narrows rows, and shows the no-match state', () => {
    const many = Array.from({ length: 9 }, (_, i) => joined(grp(`g${i + 10}`, `Group ${i}`)))
    useMyGroupsMock.mockReturnValue({
      owned: [grp('g1', 'Alpha', 'me')],
      approved: many,
      pending: [],
      loading: false,
      error: null,
    })
    renderDrawer()
    openDrawer()

    const search = screen.getByPlaceholderText(/search groups/i)
    fireEvent.change(search, { target: { value: 'Group 7' } })
    const list = getGroupList()
    expect(within(list).getByRole('button', { name: /group 7/i })).toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: /alpha/i })).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(screen.getByText(/no groups match/i)).toBeInTheDocument()
  })
})
