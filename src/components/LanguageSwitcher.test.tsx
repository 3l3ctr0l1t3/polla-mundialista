/**
 * LanguageSwitcher test (ticket 017, acceptance rule 4).
 *
 * Clicking the ES button calls `i18n.changeLanguage('es')`; the active language is
 * reflected in the pressed state. The test resets the language to English afterwards so
 * it stays deterministic and does not leak into other suites (the setup pins `en`).
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import i18n from '../i18n'
import { LanguageSwitcher } from './LanguageSwitcher'
import { theme } from '../theme/theme'

function renderSwitcher() {
  return render(
    <ThemeProvider theme={theme}>
      <LanguageSwitcher />
    </ThemeProvider>,
  )
}

afterEach(() => {
  cleanup()
  void i18n.changeLanguage('en')
})

describe('LanguageSwitcher', () => {
  it('calls i18n.changeLanguage with "es" when ES is clicked', () => {
    const spy = vi.spyOn(i18n, 'changeLanguage')
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: 'Spanish' }))

    expect(spy).toHaveBeenCalledWith('es')
    spy.mockRestore()
  })

  it('marks the active language button as pressed', () => {
    renderSwitcher()
    const enButton = screen.getByRole('button', { name: 'English' })
    expect(enButton).toHaveAttribute('aria-pressed', 'true')
  })
})
