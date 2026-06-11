import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import i18n from '../i18n'
import { AppShell } from './AppShell'
import { defaultNavItems, type NavItem } from './navItems'
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
  // jsdom doesn't implement scrollIntoView; the bottom bar calls it to keep the
  // selected destination visible. Stub it so it's observable and doesn't throw.
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
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
    expect(screen.getByRole('heading', { name: 'La Pollita CORP' })).toBeInTheDocument()
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
    for (const item of defaultNavItems(i18n.t)) {
      // Each label appears at least once (rail or bottom bar depending on width).
      expect(screen.getAllByText(item.label).length).toBeGreaterThan(0)
    }
  })

  it('honors a custom title', () => {
    renderShell(<AppShell title="Custom Title" />)
    expect(screen.getByRole('heading', { name: 'Custom Title' })).toBeInTheDocument()
  })

  it('renders titleControl in the title slot when provided (ticket 029)', () => {
    renderShell(
      <AppShell title="Fallback" titleControl={<button type="button">Switch group</button>} />,
    )
    // The interactive control renders instead of the plain title heading.
    expect(screen.getByRole('button', { name: 'Switch group' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Fallback' })).not.toBeInTheDocument()
  })

  it('renders the decorative soccer icon by default in the leading slot', () => {
    renderShell(<AppShell />)
    expect(screen.getByTestId('SportsSoccerIcon')).toBeInTheDocument()
  })

  it('renders leadingControl instead of the soccer icon when provided (ticket 030)', () => {
    renderShell(<AppShell leadingControl={<button type="button">Open group menu</button>} />)
    expect(screen.getByRole('button', { name: 'Open group menu' })).toBeInTheDocument()
    expect(screen.queryByTestId('SportsSoccerIcon')).not.toBeInTheDocument()
  })
})

describe('AppShell — mobile bottom-nav scroll (ticket 028)', () => {
  // Seven destinations — more than fit a phone — to exercise the overflow/scroll path.
  const manyItems: NavItem[] = Array.from({ length: 7 }, (_, i) => ({
    key: `dest${i}`,
    label: `Destination ${i}`,
    icon: <span aria-hidden />,
  }))

  it('renders ALL destinations even when there are many (none dropped)', () => {
    renderShell(<AppShell navItems={manyItems} selectedKey="dest3" />)
    // The mobile bar (matchMedia.matches=false) is the only nav here, so each label
    // appears exactly once — all seven are present and therefore reachable.
    for (const item of manyItems) {
      expect(screen.getByText(item.label)).toBeInTheDocument()
    }
  })

  it('scrolls the selected destination into view on mount', () => {
    const spy = window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    spy.mockClear()
    renderShell(<AppShell navItems={manyItems} selectedKey="dest5" />)
    expect(spy).toHaveBeenCalled()
  })

  it('re-scrolls into view when the selected destination changes', () => {
    const spy = window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    const { rerender } = renderShell(<AppShell navItems={manyItems} selectedKey="dest0" />)
    spy.mockClear()
    rerender(
      <ThemeProvider theme={theme}>
        <AppShell navItems={manyItems} selectedKey="dest6" />
      </ThemeProvider>,
    )
    expect(spy).toHaveBeenCalled()
  })

  it('keeps the primary-nav landmark label on the bottom bar', () => {
    renderShell(<AppShell navItems={manyItems} selectedKey="dest1" />)
    // The BottomNavigation carries the localized nav landmark aria-label.
    expect(screen.getByLabelText(i18n.t('appShell.primaryNav'))).toBeInTheDocument()
  })
})
