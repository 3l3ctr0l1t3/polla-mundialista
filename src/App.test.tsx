import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from './theme/theme'
import { AuthProvider } from './auth/AuthProvider'
import App from './App'

// Mock the auth helpers so no real Firebase Auth network call happens. The mocked
// `onAuthChange` immediately reports a signed-out user, then returns an unsubscribe.
const onAuthChangeMock = vi.fn((cb: (u: unknown) => void) => {
  cb(null)
  return () => {}
})

vi.mock('./firebase/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => onAuthChangeMock(cb),
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
}))

// db.ts is imported transitively (AuthProvider + group pages); stub the refs/helpers so
// no Firestore is touched. The signed-out path renders only LoginPage, so these are never
// invoked — they exist so the modules import cleanly.
vi.mock('./firebase/db', () => ({
  db: {},
  userDoc: vi.fn(),
  groupsCol: {},
  groupDoc: vi.fn(),
  groupMemberDoc: vi.fn(),
  memberConverter: {},
}))

function renderApp() {
  return render(
    <ThemeProvider theme={theme} defaultMode="light">
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>,
  )
}

describe('App route guard', () => {
  beforeEach(() => {
    onAuthChangeMock.mockClear()
  })

  it('shows the LoginPage when signed out', async () => {
    renderApp()
    // LoginPage renders the Google sign-in affordance for signed-out visitors.
    expect(await screen.findByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('shows the app title', async () => {
    renderApp()
    expect((await screen.findAllByText('La Pollita CORP')).length).toBeGreaterThan(0)
  })
})
