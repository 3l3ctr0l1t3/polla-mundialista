// Raw design tokens for the Polla Mundialista theme.
//
// This file holds the *source* values (palette, spacing, shape, typography
// scale, gradients). `theme.ts` assembles these into a MUI theme. Components
// must never import hard-coded colors — they consume the MUI theme, which is
// built from the tokens defined here (constitution: theme specifics isolated
// in `src/theme/`).
//
// DESIGN: "La Pollita" — a dark, neon sports aesthetic extracted from the
// user's prototype. Dark is the default/product look. Electric blue primary,
// with pink / mint / gold accents on a near-black radial backdrop.

/** Brand accent — the electric blue everything keys off of. */
export const SEED = '#36b8ff'

/** Core brand / accent colors (the neon sports palette). */
export const brand = {
  /** Electric blue — primary / info. */
  blue: '#36b8ff',
  /** Hot pink — error / "live". */
  pink: '#ff4d6d',
  /** Mint green — success / positive. */
  mint: '#46f5a0',
  /** Gold — warning / highlight. */
  gold: '#ffd24d',
  /**
   * Neon tangerine — the "partial hit" accent (right winner, wrong score; ticket 032
   * pill, user-picked). Hue 25° at the same ~100% saturation / ~62% lightness as the
   * rest of the neon family, midway between gold (45°) and pink (349°).
   */
  tangerine: '#ff8e3d',
} as const

/**
 * Dark scheme ramp. The product is dark-first: a near-black background with
 * slightly lighter elevated surfaces, off-white text, and faint neon-tinted
 * dividers. Tones for the accents are tuned to stay readable (WCAG AA) on the
 * dark surfaces.
 */
export const dark = {
  primary: {
    main: '#36b8ff',
    light: '#74cdff',
    dark: '#0a90df',
    contrastText: '#04121c',
  },
  secondary: {
    // Hot pink accent.
    main: '#ff4d6d',
    light: '#ff8097',
    dark: '#c81e44',
    contrastText: '#1a0207',
  },
  success: {
    main: '#46f5a0',
    light: '#7ff8bf',
    dark: '#10b86a',
    contrastText: '#04140c',
  },
  warning: {
    main: '#ffd24d',
    light: '#ffe08a',
    dark: '#d3a300',
    contrastText: '#1a1400',
  },
  /** Custom accent: partial scoring hit (see `brand.tangerine`). */
  tangerine: {
    main: '#ff8e3d',
    light: '#ffb27a',
    dark: '#e06a10',
    contrastText: '#1a0c02',
  },
  error: {
    main: '#ff4d6d',
    light: '#ff8097',
    dark: '#c81e44',
    contrastText: '#1a0207',
  },
  info: {
    main: '#36b8ff',
    light: '#74cdff',
    dark: '#0a90df',
    contrastText: '#04121c',
  },
  background: {
    /** Near-black page backdrop (the radial gradient sits on top via CssBaseline). */
    default: '#07090a',
    /** Elevated surface (cards, app bar, sheets). */
    paper: '#0e1416',
  },
  /** A slightly lighter elevated surface for nested panels. */
  surfaceVariant: '#141a1d',
  text: {
    primary: '#e8efea',
    // Muted desaturated off-white (~54% of primary) — meets AA on dark surfaces.
    secondary: '#9aa6a1',
    disabled: '#5d6663',
  },
  /** Faint neon-tinted hairline divider. */
  divider: 'rgba(232, 239, 234, 0.12)',
} as const

/**
 * Light scheme. Kept as a sensible companion so MUI can offer both schemes,
 * but the dark scheme above is the real product look.
 */
export const light = {
  primary: {
    main: '#0a7fc2',
    light: '#36b8ff',
    dark: '#005c92',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#d11d44',
    light: '#ff4d6d',
    dark: '#9c0029',
    contrastText: '#ffffff',
  },
  success: {
    main: '#0f9d58',
    light: '#46f5a0',
    dark: '#006b3c',
    contrastText: '#ffffff',
  },
  warning: {
    main: '#b07c00',
    light: '#ffd24d',
    dark: '#7a5400',
    contrastText: '#ffffff',
  },
  /** Custom accent: partial scoring hit (light companion of `brand.tangerine`). */
  tangerine: {
    main: '#c75e10',
    light: '#ff8e3d',
    dark: '#8f3f00',
    contrastText: '#ffffff',
  },
  error: {
    main: '#d11d44',
    light: '#ff4d6d',
    dark: '#9c0029',
    contrastText: '#ffffff',
  },
  info: {
    main: '#0a7fc2',
    light: '#36b8ff',
    dark: '#005c92',
    contrastText: '#ffffff',
  },
  background: {
    default: '#f4f7f6',
    paper: '#ffffff',
  },
  surfaceVariant: '#eaf0ee',
  text: {
    primary: '#0e1416',
    secondary: '#4a5550',
    disabled: '#8a938f',
  },
  divider: 'rgba(14, 20, 22, 0.12)',
} as const

/**
 * The signature dark backdrop — a subtle top radial gradient. Applied globally
 * via `CssBaseline` so every screen sits on the dark backdrop.
 */
export const backdrop = {
  dark: 'radial-gradient(120% 80% at 50% 0%, #0d1314 0%, #080a0b 58%, #050606 100%)',
  light: '#f4f7f6',
} as const

/** Soft neon glow used on primary/active elements (a colored box-shadow). */
export const glow = {
  primary: '0 0 0 1px rgba(54, 184, 255, 0.32), 0 6px 20px -6px rgba(54, 184, 255, 0.45)',
} as const

/** Spacing base. MUI's spacing(1) === 8px; documented for intent. */
export const SPACING_UNIT = 8

/** Corner radii — moderate, sporty. MUI `shape.borderRadius` drives most components. */
export const shape = {
  borderRadius: 10,
} as const

/** Font stacks. Barlow for body/UI, Barlow Condensed for headings/display. */
export const fonts = {
  body: ['Barlow', 'system-ui', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'].join(','),
  display: ['Barlow Condensed', 'Barlow', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'].join(
    ',',
  ),
} as const

/**
 * Type scale. Headings/display use the condensed face with tighter line-height
 * and a hint of letter-spacing for the sporty look; body/UI uses Barlow.
 */
export const typography = {
  fontFamily: fonts.body,
  h1: { fontFamily: fonts.display, fontWeight: 800, lineHeight: 1.04, letterSpacing: '0.01em' },
  h2: { fontFamily: fonts.display, fontWeight: 700, lineHeight: 1.08, letterSpacing: '0.01em' },
  h3: { fontFamily: fonts.display, fontWeight: 700, lineHeight: 1.1 },
  h4: { fontFamily: fonts.display, fontWeight: 700, lineHeight: 1.12 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  overline: {
    fontFamily: fonts.display,
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
  },
  button: { textTransform: 'none' as const, fontWeight: 600, letterSpacing: '0.01em' },
} as const

/** Layout constants shared across the shell. */
export const layout = {
  navRailWidth: 88,
  appBarHeight: 64,
} as const
