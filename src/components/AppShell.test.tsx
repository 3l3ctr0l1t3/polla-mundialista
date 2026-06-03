import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { AppShell } from './AppShell'
import { DEFAULT_NAV_ITEMS } from './navItems'
import { theme } from '../theme/theme'

// jsdom does not implement matchMedia, which `useMediaQuery` relies on.
// Stub it to a desktop-ish default (queries report no match -> mobile layout
// falls back to bottom navigation, which still renders all nav labels).
beforeAll(() => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
})

function renderShell(ui: ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

describe('AppShell', () => {
  it('renders the app title', () => {
    renderShell(
      <AppShell>
        <div>child content</div>
      </AppShell>,
    )
    expect(screen.getByRole('heading', { name: 'Polla Mundialista' })).toBeInTheDocument()
  })

  it('renders its children', () => {
    renderShell(
      <AppShell>
        <div data-testid="page">Hello</div>
      </AppShell>,
    )
    expect(screen.getByTestId('page')).toHaveTextContent('Hello')
  })

  it('renders the default navigation destinations', () => {
    renderShell(<AppShell />)
    for (const item of DEFAULT_NAV_ITEMS) {
      // Each label appears at least once (rail or bottom bar depending on width).
      expect(screen.getAllByText(item.label).length).toBeGreaterThan(0)
    }
  })

  it('honors a custom title', () => {
    renderShell(<AppShell title="Custom Title" />)
    expect(screen.getByRole('heading', { name: 'Custom Title' })).toBeInTheDocument()
  })
})
