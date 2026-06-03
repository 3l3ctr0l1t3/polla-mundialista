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
  usePendingMembers: () => usePendingMembersMock(),
}))

// Admin user from the auth context.
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'admin1', email: 'admin@x.com', displayName: 'Admin', photoURL: null },
    loading: false,
    isMember: true,
    isAdmin: true,
    memberStatus: null,
  }),
}))

// memberDoc returns a recognizable ref keyed by the target uid.
vi.mock('../firebase/db', () => ({
  memberDoc: (uid: string) => ({ __ref: 'member', uid }),
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
    status: 'pending',
    requestedAt: { toMillis: () => 0 } as unknown as Member['requestedAt'],
    decidedAt: null,
    decidedBy: null,
  }) as Member

beforeEach(() => {
  usePendingMembersMock.mockReset()
  updateDocMock.mockClear()
})

describe('AdminPage', () => {
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

  it('approve calls updateDoc with status approved + admin uid + timestamp', async () => {
    usePendingMembersMock.mockReturnValue({
      members: [pendingMember('u1', 'Ana')],
      loading: false,
      error: null,
    })
    renderPage(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: /approve ana/i }))

    await waitFor(() => expect(updateDocMock).toHaveBeenCalledTimes(1))
    expect(updateDocMock).toHaveBeenCalledWith(
      { __ref: 'member', uid: 'u1' },
      { status: 'approved', decidedBy: 'admin1', decidedAt: 'SERVER_TS' },
    )
  })

  it('reject calls updateDoc with status rejected', async () => {
    usePendingMembersMock.mockReturnValue({
      members: [pendingMember('u2', 'Beto')],
      loading: false,
      error: null,
    })
    renderPage(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: /reject beto/i }))

    await waitFor(() => expect(updateDocMock).toHaveBeenCalledTimes(1))
    expect(updateDocMock).toHaveBeenCalledWith(
      { __ref: 'member', uid: 'u2' },
      { status: 'rejected', decidedBy: 'admin1', decidedAt: 'SERVER_TS' },
    )
  })
})
