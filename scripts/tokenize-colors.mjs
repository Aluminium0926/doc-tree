// 颜色令牌化 v3：语义令牌 + 人工覆盖；只替换 :root 之外的区域
import fs from 'node:fs'

const FILE = 'public/style.css'
const BAK = 'public/style.css.bak'
let css = fs.readFileSync(BAK, 'utf8')

const TOKENS = {
  bg: '#0a0c11',
  panel: '#0f1218',
  'panel-2': '#151a22',
  'panel-3': '#1b212b',
  line: '#222836',
  'line-2': '#2d3546',
  text: '#e9edf5',
  dim: '#8b95a9',
  'dim-2': '#667085',
  quote: '#4a5261',
  accent: '#6d8dff',
  'accent-2': '#93aaff',
  'accent-deep': '#4d6bff',
  'accent-line': '#2f4370',
  'accent-contrast': '#08102a',
  ok: '#3ddc97',
  'ok-bg': '#26302a',
  warn: '#ffa726',
  err: '#f87171',
  'err-bg': '#3a1f24',
  'err-line': '#6b2c34'
}

const FIXED = {
  'code-bg': '#171b22',
  'code-head': '#12161c',
  'code-line': '#262e3b',
  paper: '#ffffff'
}

const KEEP = new Set(['#fff', '#ffffff', '#000', '#000000', '#ffe066', '#7ee787', '#ff9f80', '#ffd166', '#8ce99a'])

const OVERRIDES = {
  '#3ddc97': 'ok',
  '#9ad6b2': 'ok',
  '#26302a': 'ok-bg',
  '#ffa726': 'warn',
  '#ffc0c6': 'err',
  '#6b2c34': 'err-line',
  '#3a1f24': 'err-bg',
  '#4d6bff': 'accent-deep',
  '#08102a': 'accent-contrast',
  '#4a5261': 'quote',
  '#2f4370': 'accent-line',
  '#bccbff': 'accent-2',
  '#a9bbff': 'accent-2',
  '#b79cff': 'accent-2',
  '#c2d0ff': 'accent-2',
  '#c6d3ff': 'accent-2',
  '#cfdaff': 'accent-2',
  '#171b22': 'code-bg',
  '#12161c': 'code-head',
  '#262e3b': 'code-line'
}

function hexToRgb(h) {
  let s = h.replace('#', '')
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
function rgbToLab([r, g, b]) {
  const f = (v) => {
    v /= 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const [R, G, B] = [f(r), f(g), f(b)]
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const g2 = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  const [fx, fy, fz] = [g2(X), g2(Y), g2(Z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const labs = Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, rgbToLab(hexToRgb(v))]))

const rootStart = css.indexOf(':root')
const rootEnd = css.indexOf('}', rootStart)
const rootBlock = css.slice(0, rootEnd + 1)
let body = css.slice(rootEnd + 1)

const used = [...new Set((body.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((s) => s.toLowerCase()))]
const mapping = {}
const warnings = []

for (const hex of used) {
  if (KEEP.has(hex)) continue
  if (OVERRIDES[hex]) {
    mapping[hex] = OVERRIDES[hex]
    continue
  }
  const lab = rgbToLab(hexToRgb(hex))
  let best = null
  let bestD = Infinity
  for (const [k, tl] of Object.entries(labs)) {
    const d = Math.hypot(lab[0] - tl[0], lab[1] - tl[1], lab[2] - tl[2])
    if (d < bestD) {
      bestD = d
      best = k
    }
  }
  mapping[hex] = best
  if (bestD > 20) warnings.push(`${hex} -> --${best} (dist ${Math.round(bestD)})`)
}

for (const [hex, token] of Object.entries(mapping)) {
  const re = new RegExp(hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi')
  body = body.replace(re, `var(--${token})`)
}

const additions = [
  ['quote', TOKENS.quote],
  ['accent-deep', TOKENS['accent-deep']],
  ['accent-line', TOKENS['accent-line']],
  ['accent-contrast', TOKENS['accent-contrast']],
  ['ok', TOKENS.ok],
  ['ok-bg', TOKENS['ok-bg']],
  ['warn', TOKENS.warn],
  ['err-bg', TOKENS['err-bg']],
  ['err-line', TOKENS['err-line']],
  ['code-bg', FIXED['code-bg']],
  ['code-head', FIXED['code-head']],
  ['code-line', FIXED['code-line']],
  ['paper', FIXED.paper]
].filter(([k]) => !new RegExp(`--${k}\\s*:`).test(rootBlock))

let newRoot = rootBlock.replace(/\}\s*$/, '')
newRoot += '\n' + additions.map(([k, v]) => `  --${k}: ${v};`).join('\n') + '\n}'

fs.writeFileSync(FILE, newRoot + body, 'utf8')

console.log('替换颜色数:', Object.keys(mapping).length)
console.log('新增令牌:', additions.map((a) => a[0]).join(', '))
if (warnings.length) {
  console.log('\n待确认:')
  warnings.forEach((w) => console.log('  ' + w))
}
const left = [...new Set((fs.readFileSync(FILE, 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) || []))]
console.log('\n剩余字面颜色:', left.join(' ') || '(无)')
