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

// db.ts is imported by AuthProvider; stub the doc refs so no Firestore is touched.
// (Signed-out path never reads them, but the module must import cleanly.)
vi.mock('./firebase/db', () => ({
  userDoc: vi.fn(),
  allowlistConfigDoc: vi.fn(),
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
    expect((await screen.findAllByText('Polla Mundialista')).length).toBeGreaterThan(0)
  })
})
