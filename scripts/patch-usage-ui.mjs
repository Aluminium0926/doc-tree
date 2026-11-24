import fs from 'node:fs'

// mobile api: 捕获 usage
let m = fs.readFileSync('mobile/src/api.js', 'utf8')
m = m.replace(
  "      await streamChatWithTools(\n        messages,",
  "      const usage = await streamChatWithTools(\n        messages,"
)
m = m.replace(
  "      )\n    } catch (e) {\n      node.error = String(e.message || e)",
  "      )\n      if (usage) {\n        node.usage = usage\n        send({ type: 'usage', usage })\n      }\n    } catch (e) {\n      node.error = String(e.message || e)"
)
fs.writeFileSync('mobile/src/api.js', m)

// app.js: usage 显示
let a = fs.readFileSync('public/app.js', 'utf8')
if (!a.includes('function formatTokens')) {
  a = a.replace(
    'function clampZoom(z) {',
    `function formatTokens(n) {
  const v = Number(n) || 0
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k'
  return String(v)
}

function usageLine(u) {
  if (!u) return ''
  const parts = []
  if (u.input) parts.push(\`输入 \${formatTokens(u.input)}\`)
  if (u.cacheHit) parts.push(\`缓存 \${formatTokens(u.cacheHit)}\`)
  if (u.output) parts.push(\`输出 \${formatTokens(u.output)}\`)
  return parts.join(' · ')
}

function clampZoom(z) {`
  )
}

a = a.replace(
  "    } else if (ev.type === 'tool') {",
  `    } else if (ev.type === 'usage' && node) {
      node.usage = ev.usage
      const card = document.querySelector(\`.node[data-id="\${node.id}"]\`)
      const el = card?.querySelector('.node-usage')
      if (el) el.textContent = usageLine(node.usage)
    } else if (ev.type === 'tool') {`
)

// renderTree：回答操作行后加 usage
a = a.replace(
  "  acts.querySelector('[data-act=\"del\"]').addEventListener('click', async () => {",
  `  const usageEl = document.createElement('div')
  usageEl.className = 'node-usage'
  usageEl.textContent = usageLine(n.usage)
  usageEl.hidden = !usageEl.textContent
  card.appendChild(usageEl)
  acts.querySelector('[data-act="del"]').addEventListener('click', async () => {`
)
fs.writeFileSync('public/app.js', a)

// CSS
let css = fs.readFileSync('public/style.css', 'utf8')
if (!css.includes('.node-usage')) {
  css += `

/* 追问节点用量 */
.node-usage {
  margin-top: 4px; font-size: 10px; color: var(--dim-2);
  user-select: text;
}
`
  fs.writeFileSync('public/style.css', css)
}
console.log('usage ui wired')
