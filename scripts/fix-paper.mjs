import fs from 'node:fs'

const FILE = 'public/style.css'
let css = fs.readFileSync(FILE, 'utf8')

// 文档纸面固定为白底黑字，不随主题变
css = css.replace(/\.sheet \{\n  background: var\(--text\);\n  color: var\(--panel-2\);/, '.sheet {\n  background: var(--paper);\n  color: var(--paper-text);')
css = css.replace(/\.sheet th, \.sheet td \{ border: 1px solid var\(--text\);/, '.sheet th, .sheet td { border: 1px solid var(--paper-line);')
css = css.replace(/\.sheet th \{ background: var\(--text\);/, '.sheet th { background: var(--paper-fill);')
css = css.replace(
  /\.sheet pre \{ background: var\(--text\); border: 1px solid var\(--text\);/,
  '.sheet pre { background: var(--paper-fill); border: 1px solid var(--paper-line);'
)
css = css.replace(/\.sheet a \{ color: var\(--accent\); \}/, '.sheet a { color: var(--accent-deep); }')
css = css.replace(/\.sheet hr \{ border: none; border-top: 1px solid var\(--text\);/, '.sheet hr { border: none; border-top: 1px solid var(--paper-line);')
css = css.replace(/\.sheet code \{ background: var\(--text\);/, '.sheet code { background: var(--paper-fill); color: var(--paper-text);')
css = css.replace(
  /\.sheet blockquote \{ margin: 1em 0; padding: 2px 0 2px 14px; border-left: 3px solid var\(--text\); color: var\(--quote\); \}/,
  '.sheet blockquote { margin: 1em 0; padding: 2px 0 2px 14px; border-left: 3px solid var(--paper-line); color: var(--paper-muted); }'
)

// 固定令牌
if (!/--paper-text/.test(css)) {
  css = css.replace(
    /--paper: #ffffff;/,
    '--paper: #ffffff;\n  --paper-text: #1a1d24;\n  --paper-muted: #5b6472;\n  --paper-line: #e4e8f0;\n  --paper-fill: #f5f7fb;'
  )
}

fs.writeFileSync(FILE, css, 'utf8')

const bad = css.match(/\.sheet[^{]*\{[^}]*var\(--(text|panel|panel-2|panel-3|line|line-2|dim|dim-2|quote)\)/g) || []
console.log('sheet 里仍引用主题色的规则:', bad.length)
bad.slice(0, 6).forEach((b) => console.log('  ', b.slice(0, 90).replace(/\n/g, ' ')))
