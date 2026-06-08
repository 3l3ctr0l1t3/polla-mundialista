/**
 * Key-parity test (ticket 017, acceptance rule 3).
 *
 * Flattens the `en` and `es` bundles to dotted key paths and asserts they hold the
 * EXACT same set of keys, so neither language drifts (a missing translation in either
 * direction fails the build). The error lists the differing keys to make fixes obvious.
 */
import { describe, it, expect } from 'vitest'
import en from './locales/en.json'
import es from './locales/es.json'

/** Flatten a nested resource bundle to a sorted list of dotted key paths. */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, path))
    } else {
      keys.push(path)
    }
  }
  return keys.sort()
}

describe('i18n key parity', () => {
  const enKeys = flattenKeys(en as Record<string, unknown>)
  const esKeys = flattenKeys(es as Record<string, unknown>)

  it('has identical key sets across en and es (no missing translations)', () => {
    const enSet = new Set(enKeys)
    const esSet = new Set(esKeys)
    const missingInEs = enKeys.filter((k) => !esSet.has(k))
    const missingInEn = esKeys.filter((k) => !enSet.has(k))

    expect(
      missingInEs,
      `Keys present in en.json but missing from es.json: ${missingInEs.join(', ')}`,
    ).toEqual([])
    expect(
      missingInEn,
      `Keys present in es.json but missing from en.json: ${missingInEn.join(', ')}`,
    ).toEqual([])
  })

  it('has the same number of keys in both bundles', () => {
    expect(esKeys.length).toBe(enKeys.length)
  })
})
