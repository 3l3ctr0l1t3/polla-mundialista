import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { defaultNavItems } from './navItems'

// A trivial t() that echoes the key — enough to assert structure/order.
const t = ((key: string) => key) as unknown as TFunction

describe('defaultNavItems', () => {
  it('includes a rules item right after leaderboard', () => {
    const items = defaultNavItems(t)
    const keys = items.map((i) => i.key)
    expect(keys).toContain('rules')
    expect(keys.indexOf('rules')).toBe(keys.indexOf('leaderboard') + 1)
  })

  it('labels the rules item from nav.rules', () => {
    const rules = defaultNavItems(t).find((i) => i.key === 'rules')!
    expect(rules.label).toBe('nav.rules')
    expect(rules.icon).toBeTruthy()
  })
})
