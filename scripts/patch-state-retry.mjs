import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace(
`async function loadState() {
  const r = await fetch('/api/state').then((x) => x.json())
  S.docs = r.docs || []`,
`async function loadState() {
  const res = await fetch('/api/state')
  if (!res.ok) throw new Error('服务端返回 ' + res.status)
  const r = await res.json()
  if (!Array.isArray(r.docs)) throw new Error('返回数据不完整')
  S.docs = r.docs`
)
a=a.replace(
`  await loadState()
  renderLibrary()
  maybeWelcome()`,
`  if (await loadStateWithRetry()) {
    renderLibrary()
    maybeWelcome()
  }`
)
if(!a.includes('async function loadStateWithRetry')){
  a=a.replace(
    'async function loadState() {',
    `async function loadStateWithRetry() {
  let last = null
  for (let i = 0; i < 6; i++) {
    try {
      await loadState()
      return true
    } catch (e) {
      last = e
      setStatus('数据加载失败，正在重试 ' + (i + 1) + '/6…')
      await new Promise((r) => setTimeout(r, 700))
    }
  }
  setStatus('')
  toast('数据加载失败：' + (last?.message || '服务端未响应') + '。请完全退出应用后重新打开。', 'error')
  return false
}

async function loadState() {`
  )
}
fs.writeFileSync('public/app.js',a)
console.log('state retry ok')
