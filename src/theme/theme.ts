import { createTheme } from '@mui/material/styles'
import { tones, darkTones, shape, typography, SEED } from './tokens'

// Material Design 3 theme for Polla Mundialista.
//
// All color, spacing, shape and typography tokens live in `src/theme/`
// (see tokens.ts). Components consume this theme — they must never hard-code
// palette values (constitution: MD3 specifics isolated in the theme).
//
// Light + dark schemes are provided via MUI v9 `colorSchemes`, generated from a
// World-Cup-ish green seed. This is a sensible *default* that a custom brand can
// later replace by editing tokens.ts alone.

export { SEED }

export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'class',
  },
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: {
          main: tones.primary.main,
          light: tones.primary.light,
          dark: tones.primary.dark,
          contrastText: tones.primary.contrastText,
        },
        secondary: {
          main: tones.secondary.main,
          light: tones.secondary.light,
          dark: tones.secondary.dark,
          contrastText: tones.secondary.contrastText,
        },
        error: {
          main: tones.error.main,
          light: tones.error.light,
          dark: tones.error.dark,
          contrastText: tones.error.contrastText,
        },
        background: {
          default: tones.neutral.light.background,
          paper: tones.neutral.light.surface,
        },
        text: {
          primary: tones.neutral.light.onSurface,
          secondary: tones.neutral.light.onSurfaceVariant,
        },
        divider: tones.neutral.light.outlineVariant,
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: {
          main: darkTones.primary.main,
          light: darkTones.primary.light,
          dark: darkTones.primary.dark,
          contrastText: darkTones.primary.contrastText,
        },
        secondary: {
          main: darkTones.secondary.main,
          light: darkTones.secondary.light,
          dark: darkTones.secondary.dark,
          contrastText: darkTones.secondary.contrastText,
        },
        error: {
          main: darkTones.error.main,
          light: darkTones.error.light,
          dark: darkTones.error.dark,
          contrastText: darkTones.error.contrastText,
        },
        background: {
          default: tones.neutral.dark.background,
          paper: tones.neutral.dark.surface,
        },
        text: {
          primary: tones.neutral.dark.onSurface,
          secondary: tones.neutral.dark.onSurfaceVariant,
        },
        divider: tones.neutral.dark.outlineVariant,
      },
    },
  },
  shape,
  typography,
  components: {
    MuiAppBar: {
      defaultProps: { color: 'primary', elevation: 0 },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: shape.borderRadius },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999 },
      },
    },
  },
})

export default theme
