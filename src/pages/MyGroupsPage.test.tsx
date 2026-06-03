import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { Group } from '../shared/types'
import type { UseMyGroupsResult, JoinedGroup } from '../hooks/useMyGroups'

// --- mocks -----------------------------------------------------------------

let groupsState: UseMyGroupsResult
vi.mock('../hooks/useMyGroups', () => ({
  useMyGroups: () => groupsState,
}))

vi.mock('../firebase/auth', () => ({
  signOutUser: vi.fn(),
}))

import { MyGroupsPage } from './MyGroupsPage'

const group = (groupId: string, name: string): Group => ({
  groupId,
  name,
  ownerUid: 'me',
  ownerName: 'Me',
  ownerPhotoURL: null,
  inviteCode: 'CODE',
  createdAt: {} as Group['createdAt'],
})

const joined = (groupId: string, name: string, status: 'approved' | 'pending'): JoinedGroup => ({
  group: group(groupId, name),
  member: {
    uid: 'me',
    displayName: 'Me',
    email: 'me@x.com',
    photoURL: null,
    role: 'member',
    status,
    requestedAt: {} as JoinedGroup['member']['requestedAt'],
    decidedAt: null,
    decidedBy: null,
  },
})

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <MyGroupsPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  groupsState = { owned: [], approved: [], pending: [], loading: false, error: null }
})

describe('MyGroupsPage', () => {
  it('shows the loading state', () => {
    groupsState = { owned: [], approved: [], pending: [], loading: true, error: null }
    renderPage()
    expect(screen.getByRole('status', { name: 'Loading your groups' })).toBeInTheDocument()
  })

  it('shows the empty state when the user has no groups', () => {
    renderPage()
    expect(screen.getByText('No groups yet')).toBeInTheDocument()
  })

  it('shows the error state when the listener fails', () => {
    groupsState = {
      owned: [],
      approved: [],
      pending: [],
      loading: false,
      error: new Error('permission-denied'),
    }
    renderPage()
    expect(screen.getByText("Couldn't load your groups")).toBeInTheDocument()
  })

  it('always offers create + join affordances', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /create group/i })).toHaveAttribute(
      'href',
      '/groups/new',
    )
    expect(screen.getByRole('button', { name: /join via link/i })).toBeInTheDocument()
  })

  it('lists owned, joined, and pending groups linking into the group', () => {
    groupsState = {
      owned: [group('g1', 'My Pool')],
      approved: [joined('g2', "Friend's Pool", 'approved')],
      pending: [joined('g3', 'Office Pool', 'pending')],
      loading: false,
      error: null,
    }
    renderPage()

    // Owned + joined cards link to the group's fixtures.
    expect(screen.getByText('My Pool').closest('a')).toHaveAttribute('href', '/g/g1/fixtures')
    expect(screen.getByText("Friend's Pool").closest('a')).toHaveAttribute('href', '/g/g2/fixtures')

    // Pending request is surfaced separately (no fixtures link), with a status note.
    expect(screen.getByText('Office Pool')).toBeInTheDocument()
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument()
  })
})
