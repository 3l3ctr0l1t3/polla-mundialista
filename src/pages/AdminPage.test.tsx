import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { Member } from '../shared/types'
import type { UsePendingMembersResult } from '../hooks/usePendingMembers'
import type { UseApprovedMembersResult } from '../hooks/useApprovedMembers'

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

const useApprovedMembersMock = vi.fn<() => UseApprovedMembersResult>()
vi.mock('../hooks/useApprovedMembers', () => ({
  useApprovedMembers: () => useApprovedMembersMock(),
}))

// The current group from the group context (this admin is the group's owner ⇒ admin).
const useGroupMock = vi.fn(() => ({
  gid: 'g1',
  isGroupAdmin: true,
  group: { name: 'My Pool', mode: 'lazy' } as { name: string; mode?: 'lazy' | 'strict' },
}))
vi.mock('../group/useGroup', () => ({ useGroup: () => useGroupMock() }))

// Server clock + tournament cutoffs drive the mode "frozen" state.
const nowMock = vi.fn(() => 0)
vi.mock('../hooks/useServerTime', () => ({
  useServerTime: () => ({ now: nowMock, offsetMs: 0, offsetKnown: true }),
}))
const useTournamentConfigMock = vi.fn<() => { cutoffs?: unknown; loading: boolean }>(() => ({
  cutoffs: undefined,
  loading: false,
}))
vi.mock('../hooks/useTournamentConfig', () => ({
  useTournamentConfig: () => useTournamentConfigMock(),
}))

// Admin user from the auth context.
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'admin1', email: 'admin@x.com', displayName: 'Admin', photoURL: null },
    loading: false,
  }),
}))

// groupMemberDoc / groupDoc return recognizable refs.
vi.mock('../firebase/db', () => ({
  groupMemberDoc: (gid: string, uid: string) => ({ __ref: 'member', gid, uid }),
  groupDoc: (gid: string) => ({ __ref: 'group', gid }),
}))

const updateDocMock = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve())
const deleteDocMock = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve())
vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => 'SERVER_TS',
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
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

const approvedMember = (uid: string, name: string): Member =>
  ({
    uid,
    displayName: name,
    email: `${uid}@x.com`,
    photoURL: null,
    role: 'member',
    status: 'approved',
    requestedAt: { toMillis: () => 0 } as unknown as Member['requestedAt'],
    decidedAt: null,
    decidedBy: null,
  }) as Member

beforeEach(() => {
  usePendingMembersMock.mockReset()
  useApprovedMembersMock.mockReset()
  // Default: no approved members unless a test sets them.
  useApprovedMembersMock.mockReturnValue({ members: [], loading: false, error: null })
  updateDocMock.mockClear()
  deleteDocMock.mockClear()
  capturedGid = null
  useGroupMock.mockReturnValue({
    gid: 'g1',
    isGroupAdmin: true,
    group: { name: 'My Pool', mode: 'lazy' },
  })
  nowMock.mockReturnValue(0)
  useTournamentConfigMock.mockReturnValue({ cutoffs: undefined, loading: false })
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

describe('AdminPage — remove member', () => {
  // Keep the pending section empty/quiet for these tests.
  const noPending = () =>
    usePendingMembersMock.mockReturnValue({ members: [], loading: false, error: null })

  it('renders a row per approved member, each with a Remove control', () => {
    noPending()
    useApprovedMembersMock.mockReturnValue({
      members: [approvedMember('u1', 'Ana'), approvedMember('u2', 'Beto')],
      loading: false,
      error: null,
    })
    renderPage(<AdminPage />)
    expect(screen.getByRole('button', { name: /remove ana/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove beto/i })).toBeInTheDocument()
  })

  it('clicking Remove opens the confirm dialog and does NOT delete', () => {
    noPending()
    useApprovedMembersMock.mockReturnValue({
      members: [approvedMember('u1', 'Ana')],
      loading: false,
      error: null,
    })
    renderPage(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: /remove ana/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Remove Ana from My Pool\?/i)).toBeInTheDocument()
    expect(deleteDocMock).not.toHaveBeenCalled()
  })

  it('cancelling the dialog performs no delete', () => {
    noPending()
    useApprovedMembersMock.mockReturnValue({
      members: [approvedMember('u1', 'Ana')],
      loading: false,
      error: null,
    })
    renderPage(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: /remove ana/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(deleteDocMock).not.toHaveBeenCalled()
  })

  it('confirming deletes exactly the selected member doc', async () => {
    noPending()
    useApprovedMembersMock.mockReturnValue({
      members: [approvedMember('u1', 'Ana'), approvedMember('u2', 'Beto')],
      loading: false,
      error: null,
    })
    renderPage(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: /remove beto/i }))
    // The dialog's confirm Remove button (not the row buttons).
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /^remove$/i }))

    await waitFor(() => expect(deleteDocMock).toHaveBeenCalledTimes(1))
    expect(deleteDocMock).toHaveBeenCalledWith({ __ref: 'member', gid: 'g1', uid: 'u2' })
  })

  it('does NOT offer a Remove control for the current user', () => {
    noPending()
    useApprovedMembersMock.mockReturnValue({
      // admin1 is the current user (auth mock) and is also an approved member here.
      members: [approvedMember('admin1', 'Admin'), approvedMember('u2', 'Beto')],
      loading: false,
      error: null,
    })
    renderPage(<AdminPage />)

    expect(screen.queryByRole('button', { name: /remove admin/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove beto/i })).toBeInTheDocument()
  })
})

describe('AdminPage — prediction mode', () => {
  beforeEach(() => {
    usePendingMembersMock.mockReturnValue({ members: [], loading: false, error: null })
  })

  // A future cup-first cutoff: freeze instant is 10 min before it → not yet frozen at now=0.
  const futureCutoffs = {
    cutoffs: {
      firstCupMatchKickoffMs: 60 * 60 * 1000, // 1h in the future (vs now()=0)
      firstKnockoutKickoffMs: 14 * 24 * 60 * 60 * 1000,
    },
    loading: false,
  }

  it('renders the toggle reflecting the current mode (lazy pressed)', () => {
    renderPage(<AdminPage />)
    const lazy = screen.getByRole('button', { name: 'Lazy' })
    const strict = screen.getByRole('button', { name: 'Strict' })
    expect(lazy).toHaveAttribute('aria-pressed', 'true')
    expect(strict).toHaveAttribute('aria-pressed', 'false')
  })

  it('reflects strict when the group mode is strict', () => {
    useGroupMock.mockReturnValue({
      gid: 'g1',
      isGroupAdmin: true,
      group: { name: 'My Pool', mode: 'strict' },
    })
    renderPage(<AdminPage />)
    expect(screen.getByRole('button', { name: 'Strict' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switching to strict writes mode via updateDoc(groupDoc)', async () => {
    useTournamentConfigMock.mockReturnValue(futureCutoffs)
    renderPage(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Strict' }))

    await waitFor(() => expect(updateDocMock).toHaveBeenCalledTimes(1))
    expect(updateDocMock).toHaveBeenCalledWith({ __ref: 'group', gid: 'g1' }, { mode: 'strict' })
  })

  it('disables the toggle and shows the frozen caption once past the freeze instant', () => {
    // Freeze instant = firstCupMatchKickoff − 10min. Set now() well past it.
    useTournamentConfigMock.mockReturnValue({
      cutoffs: { firstCupMatchKickoffMs: 1000, firstKnockoutKickoffMs: 2000 },
      loading: false,
    })
    nowMock.mockReturnValue(10 * 60 * 1000) // far past (cutoff − 10min is negative)
    renderPage(<AdminPage />)

    expect(screen.getByRole('button', { name: 'Lazy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Strict' })).toBeDisabled()
    expect(screen.getByText(/the prediction mode can no longer be changed/i)).toBeInTheDocument()
  })

  it('treats a missing tournament config as not-frozen (toggle enabled)', () => {
    useTournamentConfigMock.mockReturnValue({ cutoffs: undefined, loading: false })
    renderPage(<AdminPage />)
    expect(screen.getByRole('button', { name: 'Lazy' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Strict' })).not.toBeDisabled()
  })
})
