/**
 * LanguageSwitcher — a compact EN/ES toggle (ticket 017).
 *
 * Calls `i18n.changeLanguage`, which updates the UI immediately and persists the choice
 * to `localStorage` via the detector's cache (so it wins over browser detection on the
 * next load). Lives in the AppShell top bar and on the Login page (where the shell isn't
 * mounted). Colors/shape come from the MUI theme — no hard-coded palette values.
 */
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useTranslation } from 'react-i18next'

export interface LanguageSwitcherProps {
  /** Optional smaller footprint for tight spots (top bars). */
  size?: 'small' | 'medium' | 'large'
}

export function LanguageSwitcher({ size = 'small' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  // resolvedLanguage collapses region variants (es-CO → es) to the active base.
  const active = i18n.resolvedLanguage === 'es' ? 'es' : 'en'

  const handleChange = (_: unknown, next: string | null) => {
    if (next && next !== active) {
      void i18n.changeLanguage(next)
    }
  }

  return (
    <ToggleButtonGroup
      exclusive
      size={size}
      value={active}
      onChange={handleChange}
      aria-label={t('language.switcher')}
      color="primary"
      sx={{
        '& .MuiToggleButton-root': {
          px: 1.25,
          py: 0.25,
          border: 1,
          borderColor: 'divider',
        },
      }}
    >
      <ToggleButton value="en" aria-label={t('language.english')}>
        {t('language.en')}
      </ToggleButton>
      <ToggleButton value="es" aria-label={t('language.spanish')}>
        {t('language.es')}
      </ToggleButton>
    </ToggleButtonGroup>
  )
}

export default LanguageSwitcher
