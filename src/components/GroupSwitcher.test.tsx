import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { Group } from '../shared/types'

// --- mocks -----------------------------------------------------------------

const useGroupMock = vi.fn<() => { gid: string; group: Group | null }>()
vi.mock('../group/useGroup', () => ({ useGroup: () => useGroupMock() }))

const useMyGroupsMock = vi.fn()
vi.mock('../hooks/useMyGroups', () => ({ useMyGroups: () => useMyGroupsMock() }))

const navigateMock = vi.fn()
const locationMock = { pathname: '/g/g1/leaderboard' }
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => locationMock,
}))

import { GroupSwitcher } from './GroupSwitcher'

// --- fixtures --------------------------------------------------------------

function grp(id: string, name: string): Group {
  return {
    groupId: id,
    name,
    ownerUid: 'o',
    ownerName: 'Owner',
    ownerPhotoURL: null,
  } as Group
}

function renderSwitcher() {
  return render(
    <ThemeProvider theme={theme}>
      <GroupSwitcher />
    </ThemeProvider>,
  )
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /switch group/i }))

beforeEach(() => {
  navigateMock.mockClear()
  useGroupMock.mockReturnValue({ gid: 'g1', group: grp('g1', 'Alpha') })
  useMyGroupsMock.mockReturnValue({
    owned: [grp('g1', 'Alpha')],
    approved: [{ group: grp('g2', 'Bravo') }, { group: grp('g3', 'Charlie') }],
    pending: [],
    loading: false,
    error: null,
  })
})

describe('GroupSwitcher', () => {
  it('shows the current group name on the trigger', () => {
    renderSwitcher()
    expect(screen.getByRole('button', { name: /switch group/i })).toHaveTextContent('Alpha')
  })

  it('opens a menu listing the enterable groups, current one selected', () => {
    renderSwitcher()
    openMenu()
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Alpha' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(within(menu).getByRole('menuitem', { name: 'Bravo' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Charlie' })).toBeInTheDocument()
  })

  it('dedupes a group that is both owned and an approved membership', () => {
    useMyGroupsMock.mockReturnValue({
      owned: [grp('g1', 'Alpha')],
      approved: [{ group: grp('g1', 'Alpha') }, { group: grp('g2', 'Bravo') }],
      pending: [],
      loading: false,
      error: null,
    })
    renderSwitcher()
    openMenu()
    expect(screen.getAllByRole('menuitem', { name: 'Alpha' })).toHaveLength(1)
  })

  it('navigates to the picked group on the SAME tab and closes', () => {
    renderSwitcher()
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bravo' }))
    expect(navigateMock).toHaveBeenCalledWith('/g/g2/leaderboard')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('does NOT navigate when picking the current group (just closes)', () => {
    renderSwitcher()
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alpha' }))
    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('excludes pending groups', () => {
    useMyGroupsMock.mockReturnValue({
      owned: [grp('g1', 'Alpha')],
      approved: [{ group: grp('g2', 'Bravo') }],
      pending: [{ group: grp('g9', 'PendingPool') }],
      loading: false,
      error: null,
    })
    renderSwitcher()
    openMenu()
    expect(screen.queryByRole('menuitem', { name: 'PendingPool' })).not.toBeInTheDocument()
  })

  it('exposes aria-haspopup and toggles aria-expanded', () => {
    renderSwitcher()
    const trigger = screen.getByRole('button', { name: /switch group/i })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    openMenu()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows NO search field for a short group list', () => {
    renderSwitcher()
    openMenu()
    expect(screen.queryByPlaceholderText(/search groups/i)).not.toBeInTheDocument()
  })

  it('shows a search field for many groups and filters by name', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ group: grp(`g${i}`, `Group ${i}`) }))
    useMyGroupsMock.mockReturnValue({
      owned: [grp('g1', 'Alpha')],
      approved: many,
      pending: [],
      loading: false,
      error: null,
    })
    renderSwitcher()
    openMenu()
    const search = screen.getByPlaceholderText(/search groups/i)
    expect(search).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'Group 7' } })
    expect(screen.getByRole('menuitem', { name: 'Group 7' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Alpha' })).not.toBeInTheDocument()
  })
})
