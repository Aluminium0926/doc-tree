import fs from 'node:fs'
let h=fs.readFileSync('public/index.html','utf8')
if(!h.includes('mhchem.min.js')){
  h=h.replace('<script src="/vendor/katex/katex.min.js"></script>','<script src="/vendor/katex/katex.min.js"></script>\n<script src="/vendor/katex/mhchem.min.js"></script>')
  fs.writeFileSync('public/index.html',h)
}
let a=fs.readFileSync('public/app.js','utf8')
if(!a.includes('stashBareChem')){
  a=a.replace(
    "function renderMarkdown(src) {",
    `function stashBareChem(s, stash) {
  const re = /\\\\(ce|pu)\\s*\\{/g
  let out = ''
  let last = 0
  let m
  while ((m = re.exec(s))) {
    const start = m.index
    let i = re.lastIndex
    let depth = 1
    while (i < s.length && depth > 0) {
      if (s[i] === '{') depth++
      else if (s[i] === '}') depth--
      i++
    }
    if (depth > 0) break
    out += s.slice(last, start) + stash(s.slice(start, i))
    last = i
    re.lastIndex = i
  }
  return out + s.slice(last)
}

function renderMarkdown(src) {`
  )
  a=a.replace(
    "  s = s.replace(/\\u0001F(\\d+)\\u0001F/g, (_, i) => fences[+i])",
    `  // 模型有时直接写 \\ce{...} 而不包 $...$，这里补成行内公式
  s = stashBareChem(s, (tex) => stash(tex, false))
  s = s.replace(/\\u0001F(\\d+)\\u0001F/g, (_, i) => fences[+i])`
  )
  fs.writeFileSync('public/app.js',a)
}
console.log('mhchem + bare ce ok')
