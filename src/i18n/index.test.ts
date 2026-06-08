/**
 * i18n config test (ticket 017, acceptance rules 1 & 5).
 *
 * - Region variants resolve to the base language (`es-CO` → `es`) and any unsupported
 *   language falls back to `en` (`load: 'languageOnly'` + `fallbackLng: 'en'`). We verify
 *   this on a fresh i18next instance built with the SAME options so the assertion exercises
 *   the real resolution rules without depending on the host `navigator`.
 * - The shared singleton keeps `<html lang>` in sync: firing `languageChanged` updates
 *   `document.documentElement.lang`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createInstance } from 'i18next'
import i18n from './index'
import en from './locales/en.json'
import es from './locales/es.json'

/** A standalone instance with the production resolution options (no detector/React). */
function buildInstance() {
  const inst = createInstance()
  void inst.init({
    resources: { en: { translation: en }, es: { translation: es } },
    supportedLngs: ['en', 'es'],
    fallbackLng: 'en',
    load: 'languageOnly',
    interpolation: { escapeValue: false },
  })
  return inst
}

describe('i18n language resolution', () => {
  it('resolves region variant es-CO to es', async () => {
    const inst = buildInstance()
    await inst.changeLanguage('es-CO')
    expect(inst.resolvedLanguage).toBe('es')
  })

  it('falls back to en for an unsupported language', async () => {
    const inst = buildInstance()
    await inst.changeLanguage('fr-FR')
    expect(inst.resolvedLanguage).toBe('en')
  })
})

describe('<html lang> sync', () => {
  afterEach(() => {
    void i18n.changeLanguage('en')
  })

  it('updates document.documentElement.lang when the language changes', async () => {
    await i18n.changeLanguage('es')
    expect(document.documentElement.lang).toBe('es')

    await i18n.changeLanguage('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
