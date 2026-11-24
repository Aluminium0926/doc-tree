import fs from 'node:fs'
let h=fs.readFileSync('public/index.html','utf8')
if(!h.includes('btn-web')){
  h=h.replace(
    '        <button id="btn-instr"',
    '        <button id="btn-web" class="ghost web" title="联网搜索（DeepSeek 官方，需 deepseek 接口）">联网</button>\n        <button id="btn-instr"'
  )
  fs.writeFileSync('public/index.html',h)
}
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('#btn-web')){
  c += `
#btn-web {
  font-size: 11px; padding: 3px 9px; border-radius: 999px;
  border: 1px solid var(--line-2); background: transparent; color: var(--dim);
  flex: 0 0 auto;
}
#btn-web:hover { color: var(--text); border-color: var(--accent); }
#btn-web.on { color: var(--accent-2); border-color: var(--accent); background: var(--accent-soft); }
`
  fs.writeFileSync('public/style.css',c)
}
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace('  instrMode: false,', '  instrMode: false,\n  webSearch: false,')
if(!a.includes('function setWebSearch')){
  a=a.replace(
    'function setInstrMode(on) {',
    `function setWebSearch(on) {
  S.webSearch = Boolean(on)
  const btn = $('#btn-web')
  if (btn) btn.classList.toggle('on', S.webSearch)
  setStatus(S.webSearch ? '联网搜索已开启：提问时会先查互联网并给出来源' : '')
  setTimeout(() => { if (S.webSearch) setStatus('') }, 1800)
}

function setInstrMode(on) {`
  )
}
a=a.replace(
  "      body: JSON.stringify({ docId: S.doc.id, parentId, anchor, question: q, image }),",
  "      body: JSON.stringify({ docId: S.doc.id, parentId, anchor, question: q, image, web: S.webSearch }),"
)
a=a.replace(
  "  $('#btn-instr')?.addEventListener('click', () => setInstrMode(!S.instrMode))",
  "  $('#btn-instr')?.addEventListener('click', () => setInstrMode(!S.instrMode))\n  $('#btn-web')?.addEventListener('click', () => setWebSearch(!S.webSearch))"
)
a=a.replace(
  "    } else if (ev.type === 'tool') {",
  "    } else if (ev.type === 'web') {\n      setStatus('正在联网搜索…')\n    } else if (ev.type === 'tool') {"
)
fs.writeFileSync('public/app.js',a)
console.log('web ui ok')
