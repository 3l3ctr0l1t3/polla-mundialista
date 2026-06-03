import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { Member } from '../shared/types'
import type { UsePendingMembersResult } from '../hooks/usePendingMembers'

// --- mocks -----------------------------------------------------------------

const usePendingMembersMock = vi.fn<() => UsePendingMembersResult>()
vi.mock('../hooks/usePendingMembers', () => ({
  usePendingMembers: (gid: string) => {
    // Surface the gid the page passed in so the test can assert group-scoping.
    capturedGid = gid
    return usePendingMembersMock()
  },
}))
let capturedGid: string | null = null

// The current group from the group context (this admin is the group's owner ⇒ admin).
vi.mock('../group/useGroup', () => ({
  useGroup: () => ({ gid: 'g1', isGroupAdmin: true }),
}))

// Admin user from the auth context.
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'admin1', email: 'admin@x.com', displayName: 'Admin', photoURL: null },
    loading: false,
  }),
}))

// groupMemberDoc returns a recognizable ref keyed by gid + target uid.
vi.mock('../firebase/db', () => ({
  groupMemberDoc: (gid: string, uid: string) => ({ __ref: 'member', gid, uid }),
}))

const updateDocMock = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve())
vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => 'SERVER_TS',
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
}))

// Imported after mocks are registered.
import { AdminPage } from './AdminPage'

function renderPage(ui: ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

const pendingMember = (uid: string, name: string): Member =>
  ({
    uid,
    displayName: name,
    email: `${uid}@x.com`,
    photoURL: null,
    role: 'member',
    status: 'pending',
    requestedAt: { toMillis: () => 0 } as unknown as Member['requestedAt'],
    decidedAt: null,
    decidedBy: null,
  }) as Member

beforeEach(() => {
  usePendingMembersMock.mockReset()
  updateDocMock.mockClear()
  capturedGid = null
})

describe('AdminPage (per-group)', () => {
  it('subscribes to the current group id', () => {
    usePendingMembersMock.mockReturnValue({ members: [], loading: true, error: null })
    renderPage(<AdminPage />)
    expect(capturedGid).toBe('g1')
  })

  it('shows the loading state while requests load', () => {
    usePendingMembersMock.mockReturnValue({ members: [], loading: true, error: null })
    renderPage(<AdminPage />)
    expect(screen.getByRole('status', { name: 'Loading join requests' })).toBeInTheDocument()
  })

  it('shows the empty state when there are no pending requests', () => {
    usePendingMembersMock.mockReturnValue({ members: [], loading: false, error: null })
    renderPage(<AdminPage />)
    expect(screen.getByText('No pending requests')).toBeInTheDocument()
  })

  it('shows the error state when the subscription fails', () => {
    usePendingMembersMock.mockReturnValue({
      members: [],
      loading: false,
      error: new Error('permission-denied'),
    })
    renderPage(<AdminPage />)
    expect(screen.getByText("Couldn't load requests")).toBeInTheDocument()
    expect(screen.getByText('permission-denied')).toBeInTheDocument()
  })

  it('renders a row per pending request', () => {
    usePendingMembersMock.mockReturnValue({
      members: [pendingMember('u1', 'Ana'), pendingMember('u2', 'Beto')],
      loading: false,
      error: null,
    })
    renderPage(<AdminPage />)
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Beto')).toBeInTheDocument()
  })

  it('approve writes status approved + admin uid + timestamp to the group member doc', async () => {
    usePendingMembersMock.mockReturnValue({
      members: [pendingMember('u1', 'Ana')],
      loading: false,
      error: null,
    })
    renderPage(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: /approve ana/i }))

    await waitFor(() => expect(updateDocMock).toHaveBeenCalledTimes(1))
    expect(updateDocMock).toHaveBeenCalledWith(
      { __ref: 'member', gid: 'g1', uid: 'u1' },
      { status: 'approved', decidedBy: 'admin1', decidedAt: 'SERVER_TS' },
    )
  })

  it('reject writes status rejected to the group member doc', async () => {
    usePendingMembersMock.mockReturnValue({
      members: [pendingMember('u2', 'Beto')],
      loading: false,
      error: null,
    })
    renderPage(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: /reject beto/i }))

    await waitFor(() => expect(updateDocMock).toHaveBeenCalledTimes(1))
    expect(updateDocMock).toHaveBeenCalledWith(
      { __ref: 'member', gid: 'g1', uid: 'u2' },
      { status: 'rejected', decidedBy: 'admin1', decidedAt: 'SERVER_TS' },
    )
  })
})
