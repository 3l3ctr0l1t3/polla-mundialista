import { render, screen, waitFor, act, within, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { Group, Member, LeaderboardEntry } from '../shared/types'
import type { UseAllGroupsResult } from '../hooks/useAllGroups'

// --- mocks -----------------------------------------------------------------

let groupsState: UseAllGroupsResult
vi.mock('../hooks/useAllGroups', () => ({
  useAllGroups: () => groupsState,
}))

let isSuperAdmin = true
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'me' }, loading: false, isSuperAdmin }),
}))

// Per-group members/leaderboard listeners (lazily attached on accordion expand).
vi.mock('../firebase/db', () => ({
  groupMembersCol: (gid: string) => ({ __col: 'members', gid }),
  groupLeaderboardCol: (gid: string) => ({ __col: 'leaderboard', gid }),
}))

type SnapHandler = (snap: { docs: { id: string; data: () => unknown }[] }) => void
let memberHandler: SnapHandler | null = null
let leaderboardHandler: SnapHandler | null = null

vi.mock('firebase/firestore', () => ({
  onSnapshot: (ref: { __col: string }, onNext: SnapHandler) => {
    if (ref.__col === 'members') memberHandler = onNext
    else leaderboardHandler = onNext
    return () => {}
  },
}))

import { SuperadminPage } from './SuperadminPage'

const fakeTs = {} as Group['createdAt']

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    groupId: 'g1',
    name: 'My Pool',
    ownerUid: 'owner',
    ownerName: 'Olivia Owner',
    ownerPhotoURL: null,
    inviteCode: 'ABC123',
    createdAt: fakeTs,
    ...overrides,
  }
}

function memberDoc(uid: string, displayName: string): { id: string; data: () => Member } {
  return {
    id: uid,
    data: () => ({
      uid,
      displayName,
      email: `${uid}@x.com`,
      photoURL: null,
      role: 'member',
      status: 'approved',
      requestedAt: fakeTs,
      decidedAt: null,
      decidedBy: null,
    }),
  }
}

function pointsDoc(uid: string): { id: string; data: () => LeaderboardEntry } {
  return {
    id: uid,
    data: () => ({
      uid,
      displayName: 'Alice',
      photoURL: null,
      totalPoints: 9,
      exactCount: 1,
      outcomeCount: 2,
      predictionsGraded: 3,
      rank: 1,
      updatedAt: fakeTs,
    }),
  }
}

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <SuperadminPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  groupsState = { groups: [], loading: false, error: null }
  isSuperAdmin = true
  memberHandler = null
  leaderboardHandler = null
})

describe('SuperadminPage', () => {
  it('redirects a non-superadmin away (renders nothing of the dashboard)', () => {
    isSuperAdmin = false
    groupsState = { groups: [makeGroup()], loading: false, error: null }
    renderPage()
    expect(screen.queryByRole('heading', { name: 'Superadmin' })).not.toBeInTheDocument()
    expect(screen.queryByText('My Pool')).not.toBeInTheDocument()
  })

  it('shows the loading state', () => {
    groupsState = { groups: [], loading: true, error: null }
    renderPage()
    expect(screen.getByRole('status', { name: 'Loading all groups' })).toBeInTheDocument()
  })

  it('shows the error state', () => {
    groupsState = { groups: [], loading: false, error: new Error('permission-denied') }
    renderPage()
    expect(screen.getByText("Couldn't load groups")).toBeInTheDocument()
  })

  it('shows the empty state when there are no groups', () => {
    renderPage()
    expect(screen.getByText('No groups yet')).toBeInTheDocument()
  })

  it('lists every group with owner + invite code', () => {
    groupsState = {
      groups: [
        makeGroup(),
        makeGroup({ groupId: 'g2', name: 'Office Pool', ownerName: 'Bob', inviteCode: 'XYZ789' }),
      ],
      loading: false,
      error: null,
    }
    renderPage()
    expect(screen.getByText('My Pool')).toBeInTheDocument()
    expect(screen.getByText('Office Pool')).toBeInTheDocument()
    expect(screen.getByText(/Owner: Olivia Owner/)).toBeInTheDocument()
    expect(screen.getByText(/Code: ABC123/)).toBeInTheDocument()
  })

  it('expands a group to show the owner + members and the leaderboard', async () => {
    groupsState = { groups: [makeGroup()], loading: false, error: null }
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /My Pool/ }))

    // Pushing the live member + leaderboard snapshots resolves the lazy detail.
    act(() => {
      memberHandler!({ docs: [memberDoc('a', 'Alice'), memberDoc('b', 'Bob')] })
      leaderboardHandler!({ docs: [pointsDoc('a')] })
    })

    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Participants' })).toBeInTheDocument(),
    )

    const participants = screen.getByRole('region', { name: 'Participants' })
    // The implicit owner is labelled, plus each member.
    expect(within(participants).getByText('Olivia Owner')).toBeInTheDocument()
    expect(within(participants).getAllByText('Owner').length).toBeGreaterThan(0)
    expect(within(participants).getByText('Alice')).toBeInTheDocument()
    expect(within(participants).getByText('Bob')).toBeInTheDocument()

    // The leaderboard region renders the graded row.
    const board = screen.getByRole('region', { name: 'Leaderboard' })
    expect(within(board).getByLabelText('My Pool leaderboard')).toBeInTheDocument()
  })
})
