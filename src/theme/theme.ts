import { createTheme } from '@mui/material/styles'

// Minimal Material Design 3 seed theme. All MD3 tokens live in src/theme/ —
// components consume these tokens, never hard-coded colors. Expanded in ticket 009.
export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#1769aa' },
        secondary: { main: '#43a047' },
      },
    },
  },
  shape: {
    borderRadius: 12,
  },
})
