import { createTheme } from '@mui/material/styles'
import { dark, light, backdrop, glow, shape, typography, SEED } from './tokens'

// "La Pollita" theme for Polla Mundialista — a dark, neon sports aesthetic.
//
// All color, spacing, shape and typography tokens live in `src/theme/`
// (see tokens.ts). Components consume this theme — they must never hard-code
// palette values (constitution: theme specifics isolated in the theme).
//
// Dark is the *product* look and the default scheme. A light scheme is kept as
// a companion. Both are provided via MUI v9 `colorSchemes` and a custom brand
// can be re-tuned by editing tokens.ts alone.

export { SEED }

export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'class',
  },
  defaultColorScheme: 'dark',
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: light.primary,
        secondary: light.secondary,
        success: light.success,
        warning: light.warning,
        error: light.error,
        info: light.info,
        background: light.background,
        text: {
          primary: light.text.primary,
          secondary: light.text.secondary,
          disabled: light.text.disabled,
        },
        divider: light.divider,
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: dark.primary,
        secondary: dark.secondary,
        success: dark.success,
        warning: dark.warning,
        error: dark.error,
        info: dark.info,
        background: dark.background,
        text: {
          primary: dark.text.primary,
          secondary: dark.text.secondary,
          disabled: dark.text.disabled,
        },
        divider: dark.divider,
      },
    },
  },
  shape,
  typography,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // The dark radial backdrop is part of the look — apply it globally so
        // every screen sits on the dark gradient. Light scheme uses a flat bg.
        body: {
          minHeight: '100dvh',
          backgroundColor: dark.background.default,
          backgroundImage: backdrop.dark,
          backgroundAttachment: 'fixed',
          WebkitFontSmoothing: 'antialiased',
          textRendering: 'optimizeLegibility',
        },
        '.light body, body.light': {
          backgroundColor: light.background.default,
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      // Flat, transparent app bar floating over the dark backdrop.
      defaultProps: { color: 'transparent', elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          borderBottom: `1px solid ${theme.palette.divider}`,
          backdropFilter: 'blur(8px)',
        }),
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: shape.borderRadius,
          borderColor: theme.palette.divider,
          backgroundImage: 'none',
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ ownerState }) => ({
          borderRadius: 999,
          // Soft neon glow on the primary call-to-action.
          ...(ownerState.variant === 'contained' &&
            (ownerState.color === 'primary' || ownerState.color === undefined) && {
              boxShadow: glow.primary,
              '&:hover': { boxShadow: glow.primary },
            }),
        }),
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.text.secondary,
          '&.Mui-selected': { color: theme.palette.primary.main },
        }),
      },
    },
  },
})

export default theme
