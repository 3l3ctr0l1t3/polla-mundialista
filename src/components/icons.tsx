/**
 * Custom action icons (Material Symbols outlines, 960-grid viewBox), inlined so they
 * inherit `currentColor` from the theme instead of the static fill baked into the
 * source files (`public/eye.svg`, `public/primera_vez.svg`).
 */
import SvgIcon from '@mui/material/SvgIcon'
import type { SvgIconProps } from '@mui/material/SvgIcon'

/** Eye — "see group predictions" action (from public/eye.svg). */
export function EyeIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 -960 960 960" data-testid="EyeIcon">
      <path d="M607.5-372.5Q660-425 660-500t-52.5-127.5Q555-680 480-680t-127.5 52.5Q300-575 300-500t52.5 127.5Q405-320 480-320t127.5-52.5Zm-204-51Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM214-281.5Q94-363 40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200q-146 0-266-81.5ZM480-500Zm207.5 160.5Q782-399 832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280q113 0 207.5-59.5Z" />
    </SvgIcon>
  )
}

/** Pencil-in-square — save/update score action (from public/primera_vez.svg). */
export function EditScoreIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 -960 960 960" data-testid="EditScoreIcon">
      <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h357l-80 80H200v560h560v-278l80-80v358q0 33-23.5 56.5T760-120H200Zm280-360ZM360-360v-170l367-367q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L530-360H360Zm481-424-56-56 56 56ZM440-440h56l232-232-28-28-29-28-231 231v57Zm260-260-29-28 29 28 28 28-28-28Z" />
    </SvgIcon>
  )
}
