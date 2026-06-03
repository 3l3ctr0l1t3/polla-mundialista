import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'

// --- mocks -----------------------------------------------------------------

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'me', email: 'me@x.com', displayName: 'Me' }, loading: false }),
}))

// groupDoc returns a recognizable ref; groupsCol is a sentinel `doc()` reads to mint an id.
vi.mock('../firebase/db', () => ({
  groupsCol: { __col: 'groups' },
  groupDoc: (gid: string) => ({ __ref: 'group', gid }),
}))

const docMock = vi.fn(() => ({ id: 'GEN123' }))
const setDocMock = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve())
vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => 'SERVER_TS',
  doc: (...args: unknown[]) => docMock(...(args as [])),
  setDoc: (...args: unknown[]) => setDocMock(...args),
}))

vi.mock('../group/inviteCode', () => ({
  generateInviteCode: () => 'INVITE99',
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

import { CreateGroupPage } from './CreateGroupPage'

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <CreateGroupPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  docMock.mockClear()
  setDocMock.mockClear()
  navigateMock.mockClear()
})

describe('CreateGroupPage', () => {
  it('disables create until a name is entered', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /create group/i })).toBeDisabled()
  })

  it('writes a single group doc with ownerUid == me and the generated id, then shows the invite link', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'My Pool' } })
    fireEvent.click(screen.getByRole('button', { name: /create group/i }))

    await waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1))

    // Exactly one write: the group doc (owner implicit — no member doc).
    const [ref, payload] = setDocMock.mock.calls[0]
    expect(ref).toEqual({ __ref: 'group', gid: 'GEN123' })
    expect(payload).toEqual({
      groupId: 'GEN123',
      name: 'My Pool',
      ownerUid: 'me',
      inviteCode: 'INVITE99',
      createdAt: 'SERVER_TS',
    })

    // Success view shows the shareable invite link.
    const link = (await screen.findByLabelText('Invite link')) as HTMLInputElement
    expect(link.value).toContain('/join/GEN123')
  })
})
