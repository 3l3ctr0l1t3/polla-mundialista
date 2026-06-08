// Generates the PWA manifest screenshots (richer install UI) into public/.
//   - public/screenshot-wide.png    1280x720  (form_factor: 'wide'   — desktop)
//   - public/screenshot-narrow.png   720x1280 (form_factor: 'narrow' — mobile)
// Branded promo mockups in the "La Pollita" dark-neon palette (src/theme/tokens.ts),
// rasterized from inline SVG via sharp (already a dep of @vite-pwa/assets-generator).
// Re-run with: npm run generate-screenshots
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = resolve(__dirname, '..', 'public')

const C = {
  bg: '#07090a',
  card: '#10161a',
  stroke: '#1d2a30',
  blue: '#36b8ff',
  pink: '#ff4d6d',
  mint: '#46f5a0',
  gold: '#ffd24d',
  text: '#e8f0f2',
  dim: '#8aa0a8',
}

const esc = (s) => s.replace(/&/g, '&amp;')

/** One fixture row: two team chips + a centered score. */
function matchCard(x, y, w, h, home, away, hc, ac, hs, as, accent) {
  const cx = x + w / 2
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${C.card}" stroke="${C.stroke}"/>
    <circle cx="${x + 34}" cy="${y + h / 2}" r="14" fill="${hc}"/>
    <text x="${x + 58}" y="${y + h / 2 + 6}" font-family="Arial" font-size="22" fill="${C.text}">${esc(home)}</text>
    <rect x="${cx - 46}" y="${y + h / 2 - 22}" width="40" height="44" rx="10" fill="${C.bg}" stroke="${accent}"/>
    <text x="${cx - 26}" y="${y + h / 2 + 9}" font-family="Arial" font-weight="700" font-size="26" fill="${accent}" text-anchor="middle">${hs}</text>
    <text x="${cx}" y="${y + h / 2 + 7}" font-family="Arial" font-size="20" fill="${C.dim}" text-anchor="middle">:</text>
    <rect x="${cx + 6}" y="${y + h / 2 - 22}" width="40" height="44" rx="10" fill="${C.bg}" stroke="${accent}"/>
    <text x="${cx + 26}" y="${y + h / 2 + 9}" font-family="Arial" font-weight="700" font-size="26" fill="${accent}" text-anchor="middle">${as}</text>
    <text x="${x + w - 58}" y="${y + h / 2 + 6}" font-family="Arial" font-size="22" fill="${C.text}" text-anchor="end">${esc(away)}</text>
    <circle cx="${x + w - 34}" cy="${y + h / 2}" r="14" fill="${ac}"/>`
}

function ballLogo(cx, cy, r) {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.bg}" stroke="${C.mint}" stroke-width="3"/>
    <text x="${cx}" y="${cy + r * 0.34}" font-family="Arial" font-weight="800" font-size="${r * 1.1}" fill="${C.mint}" text-anchor="middle">P</text>`
}

const bgRect = (w, h) => `
  <defs>
    <radialGradient id="g" cx="30%" cy="0%" r="120%">
      <stop offset="0%" stop-color="#0c161b"/>
      <stop offset="60%" stop-color="${C.bg}"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>`

function wideSvg() {
  const w = 1280
  const h = 720
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${bgRect(w, h)}
    ${ballLogo(150, 130, 56)}
    <text x="230" y="118" font-family="Arial" font-weight="800" font-size="56" fill="${C.text}">Polla Mundialista</text>
    <text x="232" y="160" font-family="Arial" font-size="26" fill="${C.blue}">Predict every World Cup 2026 match. Score points. Climb your group.</text>
    <text x="80" y="250" font-family="Arial" font-weight="700" font-size="30" fill="${C.text}">Fixtures</text>
    ${matchCard(80, 280, 560, 88, 'Colombia', 'Brazil', C.gold, C.mint, 2, 1, C.blue)}
    ${matchCard(80, 388, 560, 88, 'Argentina', 'France', C.blue, C.text, 3, 3, C.mint)}
    ${matchCard(80, 496, 560, 88, 'Spain', 'Germany', C.pink, C.text, 1, 0, C.blue)}
    <text x="700" y="250" font-family="Arial" font-weight="700" font-size="30" fill="${C.text}">Leaderboard</text>
    <rect x="700" y="280" width="500" height="304" rx="16" fill="${C.card}" stroke="${C.stroke}"/>
    ${[
      ['1', 'riopet64', '128', C.gold],
      ['2', 'javasmu', '113', C.mint],
      ['3', 'carlsayan69', '97', C.blue],
      ['4', 'drestrea', '84', C.dim],
    ]
      .map(
        ([r, n, p, col], i) => `
      <text x="730" y="${330 + i * 64}" font-family="Arial" font-weight="800" font-size="26" fill="${col}">${r}</text>
      <text x="775" y="${330 + i * 64}" font-family="Arial" font-size="24" fill="${C.text}">${n}</text>
      <text x="1170" y="${330 + i * 64}" font-family="Arial" font-weight="800" font-size="26" fill="${col}" text-anchor="end">${p}</text>`,
      )
      .join('')}
  </svg>`
}

function narrowSvg() {
  const w = 720
  const h = 1280
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${bgRect(w, h)}
    ${ballLogo(90, 110, 46)}
    <text x="156" y="100" font-family="Arial" font-weight="800" font-size="44" fill="${C.text}">Polla</text>
    <text x="158" y="138" font-family="Arial" font-size="22" fill="${C.blue}">World Cup 2026 predictions</text>
    <text x="48" y="230" font-family="Arial" font-weight="700" font-size="28" fill="${C.text}">Fixtures</text>
    ${matchCard(48, 260, 624, 96, 'Colombia', 'Brazil', C.gold, C.mint, 2, 1, C.blue)}
    ${matchCard(48, 372, 624, 96, 'Argentina', 'France', C.blue, C.text, 3, 3, C.mint)}
    ${matchCard(48, 484, 624, 96, 'Spain', 'Germany', C.pink, C.text, 1, 0, C.blue)}
    <text x="48" y="660" font-family="Arial" font-weight="700" font-size="28" fill="${C.text}">Leaderboard</text>
    <rect x="48" y="690" width="624" height="430" rx="18" fill="${C.card}" stroke="${C.stroke}"/>
    ${[
      ['1', 'riopet64', '128', C.gold],
      ['2', 'javasmu', '113', C.mint],
      ['3', 'carlsayan69', '97', C.blue],
      ['4', 'drestrea', '84', C.dim],
      ['5', 'sereschen', '61', C.dim],
    ]
      .map(
        ([r, n, p, col], i) => `
      <text x="84" y="${752 + i * 74}" font-family="Arial" font-weight="800" font-size="28" fill="${col}">${r}</text>
      <text x="140" y="${752 + i * 74}" font-family="Arial" font-size="26" fill="${C.text}">${n}</text>
      <text x="636" y="${752 + i * 74}" font-family="Arial" font-weight="800" font-size="28" fill="${col}" text-anchor="end">${p}</text>`,
      )
      .join('')}
    <rect x="0" y="${h - 88}" width="${w}" height="88" fill="${C.card}"/>
    ${['Fixtures', 'Predict', 'Board', 'Groups']
      .map(
        (t, i) =>
          `<text x="${90 + i * 180}" y="${h - 34}" font-family="Arial" font-size="22" fill="${i === 0 ? C.blue : C.dim}" text-anchor="middle">${t}</text>`,
      )
      .join('')}
  </svg>`
}

async function main() {
  await sharp(Buffer.from(wideSvg())).png().toFile(resolve(PUBLIC, 'screenshot-wide.png'))
  await sharp(Buffer.from(narrowSvg())).png().toFile(resolve(PUBLIC, 'screenshot-narrow.png'))
  console.log(
    'Wrote public/screenshot-wide.png (1280x720) + public/screenshot-narrow.png (720x1280)',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
