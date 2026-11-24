import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// 操作栏：停止过的节点显示“继续”
t = t.replace(
  "  acts.innerHTML = `<button data-act=\"again\">追问</button><button data-act=\"copy\">复制</button><button data-act=\"del\">删除</button>`",
  "  acts.innerHTML = (n.stopped ? '<button data-act=\"resume\">继续</button>' : '') + `<button data-act=\"again\">追问</button><button data-act=\"copy\">复制</button><button data-act=\"del\">删除</button>`\n  acts.querySelector('[data-act=\"resume\"]')?.addEventListener('click', () => resumeNode(n.id))"
)

// 恢复函数
if (!t.includes('async function resumeNode')) {
  t = t.replace(
    'async function consumeStream(res) {',
    `async function resumeNode(id) {
  if (!S.doc || S.busy) return
  S.busy = true
  $('#btn-send').disabled = true
  $('#btn-stop').hidden = false
  setStatus('继续生成…')
  const ac = new AbortController()
  S.abort = ac
  try {
    const res = await fetch('/api/ask/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId: S.doc.id, nodeId: id }),
      signal: ac.signal
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || \`请求失败 \${res.status}\`)
    }
    await consumeStream(res)
  } catch (e) {
    if (e && e.name === 'AbortError') setStatus('已停止')
    else {
      toast(e.message)
      setStatus('')
    }
  } finally {
    S.abort = null
    S.busy = false
    $('#btn-send').disabled = false
    $('#btn-stop').hidden = true
  }
}

async function consumeStream(res) {`
  )
}
fs.writeFileSync(F, t)
console.log('resume ui ok')
