// Raw design tokens for the Polla Mundialista MD3 theme.
//
// This file holds the *source* values (seed color, tonal palettes, spacing,
// shape, typography scale). `theme.ts` assembles these into a MUI theme.
// Components must never import hard-coded colors — they consume the MUI theme,
// which is built from the tokens defined here.
//
// NOTE: This is a sensible *default* MD3 palette generated from a
// World-Cup-ish seed. A custom brand design may replace these values later
// without touching component code.

/** The MD3 seed color the rest of the palette is derived from (a football-pitch green). */
export const SEED = '#2e7d32'

/**
 * Tonal palettes (a subset of the MD3 tonal range) derived from the seed and
 * its harmonized accents. Values are hand-tuned approximations of the MD3
 * Material Color Utilities output for the seed above — enough tones to drive a
 * light + dark scheme without pulling in an extra dependency.
 */
export const tones = {
  primary: {
    main: '#2e7d32',
    light: '#60ad5e',
    dark: '#005005',
    container: '#a5d6a7',
    onContainer: '#002106',
    contrastText: '#ffffff',
  },
  secondary: {
    // A warm "match-day" amber.
    main: '#b26a00',
    light: '#e89a3c',
    dark: '#7c4700',
    container: '#ffddb3',
    onContainer: '#2a1700',
    contrastText: '#ffffff',
  },
  tertiary: {
    // A cool sky accent for highlights / charts.
    main: '#00658f',
    light: '#4a90b8',
    dark: '#004c6d',
    container: '#c5e7ff',
    onContainer: '#001e2e',
    contrastText: '#ffffff',
  },
  error: {
    main: '#ba1a1a',
    light: '#de3730',
    dark: '#93000a',
    container: '#ffdad6',
    onContainer: '#410002',
    contrastText: '#ffffff',
  },
  neutral: {
    // Surface / background ramp.
    light: {
      background: '#fbfdf8',
      surface: '#fbfdf8',
      surfaceVariant: '#dee5d8',
      onSurface: '#191c19',
      onSurfaceVariant: '#424940',
      outline: '#72796f',
      outlineVariant: '#c1c9bd',
    },
    dark: {
      background: '#191c19',
      surface: '#191c19',
      surfaceVariant: '#424940',
      onSurface: '#e1e3dd',
      onSurfaceVariant: '#c1c9bd',
      outline: '#8c9388',
      outlineVariant: '#424940',
    },
  },
} as const

/** Dark-scheme tonal overrides for the accent palettes (lighter tones read better on dark surfaces). */
export const darkTones = {
  primary: {
    main: '#8bd989',
    light: '#a5d6a7',
    dark: '#005005',
    container: '#005005',
    onContainer: '#a5d6a7',
    contrastText: '#003910',
  },
  secondary: {
    main: '#ffb95c',
    light: '#ffddb3',
    dark: '#5e3600',
    container: '#7c4700',
    onContainer: '#ffddb3',
    contrastText: '#462a00',
  },
  tertiary: {
    main: '#85cfff',
    light: '#c5e7ff',
    dark: '#004c6d',
    container: '#004c6d',
    onContainer: '#c5e7ff',
    contrastText: '#003351',
  },
  error: {
    main: '#ffb4ab',
    light: '#ffdad6',
    dark: '#690005',
    container: '#93000a',
    onContainer: '#ffdad6',
    contrastText: '#690005',
  },
} as const

/** MD3 uses a 4px base grid; MUI's spacing(1) === 8px, so we keep MUI's default 8 but document intent. */
export const SPACING_UNIT = 8

/** MD3-ish corner radii. MUI `shape.borderRadius` drives most components. */
export const shape = {
  borderRadius: 12,
} as const

/** Type scale — kept close to MD3 roles, expressed in MUI variant terms. */
export const typography = {
  fontFamily: ['Roboto', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'].join(','),
  h4: { fontWeight: 600 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  button: { textTransform: 'none' as const, fontWeight: 600 },
} as const

/** Layout constants shared across the shell. */
export const layout = {
  navRailWidth: 88,
  appBarHeight: 64,
} as const
