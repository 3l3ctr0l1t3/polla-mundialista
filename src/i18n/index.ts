/**
 * i18n bootstrap (ticket 017).
 *
 * Initializes i18next once with bundled `en`/`es` resources (imported statically so
 * init is synchronous — no Suspense, no HTTP backend, no flash of keys). The active
 * language is auto-detected from the browser (`navigator`) with a persisted manual
 * override (`localStorage`), falling back to English for any unsupported language.
 * `load: 'languageOnly'` collapses region variants (`es-CO` → `es`).
 *
 * Side-effect import: `import './i18n'` at the top of `src/main.tsx` (and the test
 * setup) wires this up before anything renders.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import es from './locales/es.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    supportedLngs: ['en', 'es'],
    fallbackLng: 'en',
    // Collapse region variants (es-CO, es-MX, en-US, …) to the base language.
    load: 'languageOnly',
    detection: {
      // A stored manual choice (localStorage) always beats the browser default.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      // React already escapes interpolated values.
      escapeValue: false,
    },
    react: {
      // Resources are bundled synchronously, so no Suspense boundary is needed.
      useSuspense: false,
    },
  })

/**
 * Keep <html lang> in sync with the active language (accessibility + SEO).
 * Guarded for non-DOM environments (e.g. the Node-env ingestion unit tests that
 * transitively import this module via the shared test setup) where `document`
 * is undefined.
 */
const setHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng
  }
}
setHtmlLang(i18n.resolvedLanguage ?? 'en')
i18n.on('languageChanged', setHtmlLang)

export default i18n
