import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme/theme'
import { FullScreenLoader } from './FullScreenLoader'

function renderLoader(label?: string) {
  return render(
    <ThemeProvider theme={theme}>
      <FullScreenLoader label={label} />
    </ThemeProvider>,
  )
}

describe('FullScreenLoader', () => {
  it('renders a circular spinner inside an accessible status region (no skeletons)', () => {
    renderLoader('Checking your session')
    const status = screen.getByRole('status', { name: 'Checking your session' })
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status.querySelector('.MuiCircularProgress-root')).not.toBeNull()
    expect(status.querySelector('.MuiSkeleton-root')).toBeNull()
  })

  it('falls back to the localized generic loading label', () => {
    renderLoader()
    expect(screen.getByRole('status')).toHaveAccessibleName()
  })
})
