import fs from 'node:fs'

// ---- lib/llm.mjs：重试 ----
let t = fs.readFileSync('lib/llm.mjs', 'utf8')
if (!t.includes('async function fetchWithRetry')) {
  t = t.replace(
    'function normalizeUsage(u, format, rounds = 1) {',
    `const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchWithRetry(url, opts, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, opts)
      const retryable = res.status === 429 || [500, 502, 503, 504].includes(res.status)
      if (res.ok || !retryable || attempt >= retries) return res
      const retryAfter = Number(res.headers.get('retry-after')) * 1000
      await sleep(retryAfter > 0 ? retryAfter : 600 * 2 ** attempt)
    } catch (e) {
      if (opts?.signal?.aborted || attempt >= retries) throw e
      await sleep(600 * 2 ** attempt)
    }
  }
}

function normalizeUsage(u, format, rounds = 1) {`
  )
}
t = t.split('await fetch(').join('await fetchWithRetry(')
fs.writeFileSync('lib/llm.mjs', t)

// ---- context：search_docs 命中页前后扩展 ----
let c = fs.readFileSync('lib/context.mjs', 'utf8')
c = c.replace(
  "      for (const c of splitChunks(d)) chunks.push({ ...c, title: d.title })",
  "      for (const c of splitChunks(d)) chunks.push({ ...c, title: d.title, docId: d.id })"
)
c = c.replace(
  `    return hits
      .map((c) => \`《\${c.title}》第\${c.page}页：\\n\${c.text.slice(0, 900)}\`)
      .join('\\n\\n---\\n\\n')`,
  `    return hits
      .map((c, i) => {
        const d = docs.find((x) => x.id === c.docId)
        let extra = ''
        if (d && i < 3) {
          const prev = (d.pages || []).find((p) => p.no === c.page - 1)
          const next = (d.pages || []).find((p) => p.no === c.page + 1)
          if (prev?.text?.trim()) extra += \`\\n（上一页开头：\${prev.text.trim().slice(0, 160)}…）\`
          if (next?.text?.trim()) extra += \`\\n（下一页开头：\${next.text.trim().slice(0, 160)}…）\`
        }
        return \`《\${c.title}》第\${c.page}页：\\n\${c.text.slice(0, 900)}\${extra}\`
      })
      .join('\\n\\n---\\n\\n')`
)
fs.writeFileSync('lib/context.mjs', c)
console.log('retry + neighbor expansion ok')
