import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the Polla Mundialista title', () => {
    render(<App />)
    expect(screen.getAllByText('Polla Mundialista').length).toBeGreaterThan(0)
  })
})
