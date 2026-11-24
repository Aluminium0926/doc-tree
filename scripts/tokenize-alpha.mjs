import fs from 'node:fs'

const FILE = 'public/style.css'
let css = fs.readFileSync(FILE, 'utf8')

// 深色 rgba 面板 → 跟随令牌 + 透明度
css = css.replace(/rgba\(15,\s*18,\s*24,\s*0\.92\)/g, 'color-mix(in srgb, var(--panel) 92%, transparent)')
css = css.replace(/rgba\(27,\s*33,\s*47,\s*0\.97\)/g, 'color-mix(in srgb, var(--panel-3) 97%, transparent)')

// 强调色光晕/选区：按主色派生
const accentAlpha = (a) => `color-mix(in srgb, var(--accent) ${Math.round(a * 100)}%, transparent)`
css = css.replace(/rgba\(109,\s*141,\s*255,\s*([0-9.]+)\)/g, (_, a) => accentAlpha(parseFloat(a)))
css = css.replace(/rgba\(61,\s*220,\s*151,\s*([0-9.]+)\)/g, (_, a) => `color-mix(in srgb, var(--ok) ${Math.round(parseFloat(a) * 100)}%, transparent)`)
css = css.replace(/rgba\(248,\s*113,\s*113,\s*([0-9.]+)\)/g, (_, a) => `color-mix(in srgb, var(--err) ${Math.round(parseFloat(a) * 100)}%, transparent)`)

// 代码卡片：文字与工具色固定（不随明暗变），否则浅色下看不见
css = css.replace(
  /\.code-card pre code \{[^}]*\}/,
  '.code-card pre code { background: none !important; border: 0 !important; padding: 0 !important; border-radius: 0 !important; font-size: 12.5px !important; line-height: 1.7 !important; color: #dbe4f0; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; display: block; white-space: pre; tab-size: 4; }'
)
css = css.replace(/\.code-lang \{[^}]*\}/, '.code-lang { font-size: 12px; color: #8b96ab; letter-spacing: .02em; }')
css = css.replace(/\.code-btn \{[^}]*\}/, '.code-btn { display: inline-flex; align-items: center; gap: 5px; background: transparent; border: 1px solid transparent; color: #93a0b5; font-size: 12px; padding: 4px 8px; border-radius: 7px; cursor: pointer; }')

fs.writeFileSync(FILE, css, 'utf8')
const left = [...new Set((css.match(/rgba?\([^)]+\)/g) || []))].filter((v) => !/rgba?\(\s*(0|255),\s*(0|255),\s*(0|255)/.test(v))
console.log('剩余非黑白 rgba:', left.length)
for (const v of left.slice(0, 12)) console.log(' ', v)
