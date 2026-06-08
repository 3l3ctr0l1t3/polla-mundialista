import '@testing-library/jest-dom'
import i18n from '../i18n'

// Pin the language to English for deterministic component tests: assertions that
// expect the default English render keep passing regardless of the host locale.
void i18n.changeLanguage('en')
