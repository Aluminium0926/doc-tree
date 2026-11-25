// v153 API 测试：自带假模型 + 独立数据目录，不碰真实数据
// 用法：node scripts/test-api.mjs
import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.TEST_PORT || 4319)
const MOCK_PORT = Number(process.env.TEST_MOCK_PORT || 4399)
const DATA = await fsp.mkdtemp(path.join(os.tmpdir(), 'doctree-test-'))
process.env.DOCTREE_DATA = DATA
process.env.PORT = String(PORT)
process.env.HOST = '127.0.0.1'

const API = `http://127.0.0.1:${PORT}`
const MOCK = `http://127.0.0.1:${MOCK_PORT}`
const CLIENT = { 'x-doctree-client': 'test-suite' }

let pass = 0
const fails = []
function ok(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log('  ok   ' + name)
  } else {
    fails.push(name + (extra ? ' → ' + extra : ''))
    console.log('  FAIL ' + name + (extra ? ' → ' + extra : ''))
  }
}
const eq = (name, actual, expected) => ok(name, actual === expected, `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`)

/* ---------------- 假模型 ---------------- */
let lastLlmPayload = null // 用来断言系统提示词里的协议（化学块规则等）
const mock = http.createServer(async (req, res) => {
  let raw = ''
  for await (const c of req) raw += c
  const body = JSON.parse(raw || '{}')
  lastLlmPayload = body
  const lastUser = [...(body.messages || [])].reverse().find((m) => m.role === 'user')
  const text = '模拟回答：' + String(lastUser?.content || '').slice(0, 30)
  if (!body.stream) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ choices: [{ message: { content: '（模拟摘要）' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }))
  }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  for (const piece of [text.slice(0, 6), text.slice(6)]) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`)
    await new Promise((r) => setTimeout(r, 15))
    if (res.destroyed) return
  }
  res.write(`data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20, prompt_cache_hit_tokens: 4, prompt_cache_miss_tokens: 8 } })}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
})
await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r))

/* ---------------- 启动被测服务 ---------------- */
await fsp.mkdir(path.join(DATA, 'docs'), { recursive: true })
await fsp.mkdir(path.join(DATA, 'trees'), { recursive: true })
await fsp.mkdir(path.join(DATA, 'files'), { recursive: true })
await fsp.writeFile(
  path.join(DATA, 'config.json'),
  JSON.stringify({ baseUrl: MOCK, apiKey: 'sk-test', model: 'mock', visionModel: 'mock', pageImage: 'never' })
)
await import(pathToFileURL(path.join(ROOT, 'server.mjs')).href)

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${API}/api/state`)
    if (r.ok) break
  } catch {}
  await wait(100)
}

/* ---------------- 辅助 ---------------- */
async function req(method, p, { body, headers = {}, raw = false } = {}) {
  const opts = { method, headers: { ...headers } }
  if (body !== undefined) {
    opts.body = raw ? body : JSON.stringify(body)
  }
  const res = await fetch(API + p, opts)
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, headers: res.headers, text, json }
}
const post = (p, body, headers = {}) => req('POST', p, { body, headers: { ...CLIENT, 'content-type': 'application/json', ...headers } })
const get = (p, headers = {}) => req('GET', p, { headers })

async function sse(p, body) {
  const res = await fetch(API + p, {
    method: 'POST',
    headers: { ...CLIENT, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const all = []
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line.startsWith('data:')) continue
      try {
        all.push(JSON.parse(line.slice(5).trim()))
      } catch {}
    }
  }
  return { status: res.status, events: all }
}

/* ---------------- 用例 ---------------- */
console.log('\n=== 1. 基础 / 静态资源 ===')
{
  const s = await get('/api/state')
  eq('state 200', s.status, 200)
  const pkg = JSON.parse(await fsp.readFile(path.join(ROOT, 'package.json'), 'utf8'))
  eq('serverVersion 与 package.json 一致', s.json.serverVersion, pkg.version)
  ok('state 不泄露 apiKey', !JSON.stringify(s.json).includes('sk-test'))

  const idx = await get('/')
  eq('首页 200', idx.status, 200)
  ok('首页是 html', /文档树/.test(idx.text))
  const js = await get(`/app.js`)
  eq('app.js 200', js.status, 200)
  const trav = await get('/../lib/llm.mjs')
  ok('静态路径穿越被挡住', trav.status === 404 || trav.status === 403, 'status=' + trav.status)
  const trav2 = await get('/%2e%2e/lib/llm.mjs')
  ok('编码穿越被挡住', trav2.status === 404 || trav2.status === 403, 'status=' + trav2.status)
}

console.log('\n=== 2. 写操作守卫（CSRF） ===')
{
  const noHeader = await req('POST', '/api/config', { body: { baseUrl: 'https://evil.example/v1' } })
  eq('缺客户端头 → 400', noHeader.status, 400)

  const badOrigin = await req('POST', '/api/config', {
    body: { baseUrl: 'https://evil.example/v1' },
    headers: { ...CLIENT, 'content-type': 'application/json', origin: 'https://evil.example' }
  })
  eq('跨站 Origin → 400', badOrigin.status, 400)

  const textPlain = await req('POST', '/api/config', {
    body: JSON.stringify({ baseUrl: 'https://evil.example/v1' }),
    raw: true,
    headers: { ...CLIENT, 'content-type': 'text/plain' }
  })
  eq('text/plain 冒充 JSON → 400', textPlain.status, 400)

  const goodOrigin = await req('POST', '/api/config', {
    body: { effort: 'low' },
    headers: { ...CLIENT, 'content-type': 'application/json', origin: API }
  })
  eq('同源 Origin → 200', goodOrigin.status, 200)
  const st = await get('/api/state')
  eq('baseUrl 没有被改掉', st.json.config.baseUrl, MOCK)
}

console.log('\n=== 3. id 校验 / 路径穿越 ===')
{
  const cases = [
    ['/api/doc/purge', { id: '../config' }, 'purge ../config'],
    ['/api/doc/restore', { id: '../../etc/passwd' }, 'restore ../../etc/passwd'],
    ['/api/node/delete', { docId: '../config', nodeId: 'aaaaaa' }, 'node/delete ../config'],
    ['/api/highlights', { docId: '../config', highlights: [] }, 'highlights ../config']
  ]
  for (const [p, body, name] of cases) {
    const r = await post(p, body)
    eq(name + ' → 400', r.status, 400)
  }
  ok('config.json 仍在', fs.existsSync(path.join(DATA, 'config.json')))
  const badPath = await get('/api/doc/..%2fconfig')
  eq('GET /api/doc/..%2fconfig → 400', badPath.status, 400)
}

console.log('\n=== 4. 空 body ===')
{
  const r = await req('POST', '/api/flags', { body: '', raw: true, headers: { ...CLIENT, 'content-type': 'application/json' } })
  eq('空 body 不再 500（当空对象处理）', r.status, 200)
  const r2 = await req('POST', '/api/flags', { body: '{bad json', raw: true, headers: { ...CLIENT, 'content-type': 'application/json' } })
  eq('坏 JSON → 400', r2.status, 400)
}

console.log('\n=== 5. 导入 / 读取 / 文件 ===')
let docA, docB
{
  const r = await fetch(API + '/api/import', {
    method: 'POST',
    headers: { ...CLIENT, 'x-filename': encodeURIComponent('测试文档.txt') },
    body: Buffer.from('第一段：文档树是本地阅读器。\n\n第二段：选中文字就能提问。')
  })
  const j = await r.json()
  eq('导入 txt 200', r.status, 200)
  ok('拿到 doc id', Boolean(j.doc?.id))
  docA = j.doc.id

  const r2 = await fetch(API + '/api/import', {
    method: 'POST',
    headers: { 'x-filename': encodeURIComponent('b.md') },
    body: Buffer.from('# 第二份\n\n内容 B')
  })
  eq('导入缺客户端头 → 400', r2.status, 400)

  const r3 = await fetch(API + '/api/import', {
    method: 'POST',
    headers: { ...CLIENT, 'x-filename': encodeURIComponent('b.md') },
    body: Buffer.from('# 第二份\n\n内容 B')
  })
  docB = (await r3.json()).doc.id
  ok('导入第二份', Boolean(docB))

  const d = await get(`/api/doc/${docA}`)
  eq('读取文档 200', d.status, 200)
  ok('文档带 pages 文本', Array.isArray(d.json.doc.pages) && d.json.doc.pages[0].text.includes('本地阅读器'))
  ok('文档带空树', d.json.tree && typeof d.json.tree.nodes === 'object')

  const notFound = await get('/api/doc/aaaaaaaaaaaa')
  eq('不存在的文档 → 404', notFound.status, 404)

  // Range
  const full = await fetch(`${API}/api/file/${docA}`)
  const buf = Buffer.from(await full.arrayBuffer())
  eq('原文件 200', full.status, 200)
  ok('声明 accept-ranges', full.headers.get('accept-ranges') === 'bytes')
  const part = await fetch(`${API}/api/file/${docA}`, { headers: { range: 'bytes=0-9' } })
  eq('Range → 206', part.status, 206)
  ok('Content-Range 正确', /^bytes 0-9\//.test(part.headers.get('content-range') || ''), part.headers.get('content-range'))
  eq('Range 长度 10', (await part.arrayBuffer()).byteLength, 10)
  const badRange = await fetch(`${API}/api/file/${docA}`, { headers: { range: 'bytes=999999-' } })
  eq('越界 Range → 416', badRange.status, 416)
  const head = await fetch(`${API}/api/file/${docA}`, { method: 'HEAD' })
  eq('HEAD → 200', head.status, 200)

  const missing = await get('/api/file/aaaaaaaaaaaa')
  eq('文件不存在 → 404', missing.status, 404)
}

console.log('\n=== 6. 提问 / 续写（假模型） ===')
let nodeId
{
  const a = await sse('/api/ask', { docId: docA, question: '这是什么？', anchor: { kind: 'doc', page: 1, quote: '' } })
  eq('ask 200', a.status, 200)
  ok('收到 meta', a.events.some((e) => e.type === 'meta'))
  ok('收到 delta', a.events.some((e) => e.type === 'delta'))
  ok('收到 done', a.events.some((e) => e.type === 'done'))
  const done = a.events.find((e) => e.type === 'done')
  nodeId = done?.node?.id
  ok('回答有内容', (done?.node?.answer || '').length > 0, done?.node?.answer)
  ok('用量已记录', Boolean(done?.node?.usage), JSON.stringify(done?.node?.usage))

  // 系统提示词协议：化学块规则（单结构用 smiles、reaction 左右必须不同、空 conditions 省略）
  const sys = (lastLlmPayload?.messages || [])
    .filter((m) => m.role === 'system')
    .map((m) => String(m.content || ''))
    .join('\n')
  ok('系统提示包含化学块协议', sys.includes('单个结构') && sys.includes('A>>A') && sys.includes('reaction'), sys.slice(0, 60))
  ok('系统提示要求省略空 conditions', sys.includes('没有条件就整行省略'))
  ok('系统提示要求不要拆 reactants:/products:', sys.includes('reactants:/products:'))

  const d = await get(`/api/doc/${docA}`)
  ok('树里存了这个节点', Boolean(d.json.tree.nodes[nodeId]))
  eq('节点问题正确', d.json.tree.nodes[nodeId].question, '这是什么？')

  const r = await sse('/api/ask/resume', { docId: docA, nodeId })
  eq('resume 200', r.status, 200)
  const errEvent = r.events.find((e) => e.type === 'error')
  ok('续写没有报错（旧版这里是 webSearch is not defined）', !errEvent, errEvent?.message)
  ok('续写有 delta', r.events.some((e) => e.type === 'delta'))
  const rDone = r.events.find((e) => e.type === 'done')
  ok('续写后答案变长', (rDone?.node?.answer || '').length > (done?.node?.answer || '').length)
  eq('续写用量累加', rDone?.node?.usage?.rounds >= 2, true)

  const bad = await sse('/api/ask', { docId: docA, question: 'x', web: true })
  eq('非 deepseek 开联网 → 400 并说明原因', bad.status, 400)
}

console.log('\n=== 6.5 随问题附带的图片 ===')
{
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const partsOf = () => (lastLlmPayload?.messages || []).flatMap((m) => (Array.isArray(m.content) ? m.content : []))
  const a = await sse('/api/ask', { docId: docA, question: '这张图是什么？', anchor: { kind: 'doc', page: 1, quote: '' }, image: png })
  eq('带图提问 200', a.status, 200)
  const parts = partsOf()
  ok(
    '图片作为 image_url 送给模型',
    parts.some((p) => p.type === 'image_url' && String(p.image_url?.url || '').startsWith('data:image/png')),
    JSON.stringify(parts.map((p) => p.type))
  )
  const node = a.events.find((e) => e.type === 'done')?.node
  ok('节点标记带了图（续写时不再附页图）', node?.hadImage === true, JSON.stringify(node?.hadImage))

  const b = await sse('/api/ask', { docId: docA, question: '非法图片测试', anchor: { kind: 'doc', page: 1, quote: '' }, image: 'http://evil.example/x.png' })
  eq('非法图片被忽略但仍能提问', b.status, 200)
  ok('非法图片没有送给模型', !partsOf().some((p) => p.type === 'image_url'))

  const c = await sse('/api/ask', {
    docId: docA,
    question: '超长图片',
    anchor: { kind: 'doc', page: 1, quote: '' },
    image: 'data:image/png;base64,' + 'A'.repeat(1_900_000)
  })
  eq('超长图片被忽略但仍能提问', c.status, 200)
  ok('超长图片没有送给模型', !partsOf().some((p) => p.type === 'image_url'))
}

console.log('\n=== 7. 树 / 分组 / 导出 / 高亮 / 指令 ===')
{
  // 再问一次，产生父子节点，然后删父节点看子节点是否一起没
  const child = await sse('/api/ask', { docId: docA, question: '追问', parentId: nodeId, anchor: { kind: 'answer', nodeId, quote: 'x', page: 1 } })
  const childId = child.events.find((e) => e.type === 'done')?.node?.id
  ok('子节点已创建', Boolean(childId))

  const del = await post('/api/node/delete', { docId: docA, nodeId })
  eq('删节点 200', del.status, 200)
  ok('删父节点时子节点一起删', del.json.removed.includes(childId))
  const d = await get(`/api/doc/${docA}`)
  ok('树里两个节点都没了', !d.json.tree.nodes[nodeId] && !d.json.tree.nodes[childId])

  const g = await post('/api/group', { name: '测试组', docIds: [docA, docB] })
  eq('建组 200', g.status, 200)
  ok('组 id 存在', Boolean(g.json.group?.id))
  const st = await get('/api/state')
  ok('组出现在 state 里', st.json.groups.some((x) => x.id === g.json.group.id))
  const upd = await post('/api/group/update', { id: g.json.group.id, name: '改名了' })
  eq('改组名 200', upd.status, 200)
  const dis = await post('/api/group/dissolve', { id: g.json.group.id })
  eq('解散组 200', dis.status, 200)

  const ask2 = await sse('/api/ask', { docId: docA, question: '导出测试', anchor: { kind: 'doc', page: 1, quote: '' } })
  ok('再问一次成功', ask2.events.some((e) => e.type === 'done'))
  const exp = await get(`/api/export/${docA}`)
  eq('导出 200', exp.status, 200)
  ok('导出含问题', exp.text.includes('导出测试'))
  ok('导出是 markdown 类型', /text\/markdown/.test(exp.headers.get('content-type') || ''))

  const hl = await post('/api/highlights', { docId: docA, highlights: [{ id: 'h1', page: 1, rects: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.02 }], color: '#ffe066' }] })
  eq('保存高亮 200', hl.status, 200)
  const d2 = await get(`/api/doc/${docA}`)
  eq('高亮已落盘', d2.json.doc.highlights.length, 1)

  const ins = await post('/api/instruction', { docId: docA, text: '以后用英文回答' })
  eq('指令 200', ins.status, 200)
  const rm = await post('/api/instruction/remove', { docId: docA, clear: true })
  eq('清空指令 200', rm.status, 200)
  eq('指令已清空', rm.json.count, 0)

  const usage = await get('/api/usage')
  eq('usage 200', usage.status, 200)
  ok('usage 有总量', usage.json.totals.requests >= 1, JSON.stringify(usage.json.totals))

  const flags = await post('/api/flags', { welcomeSeen: true })
  eq('flags 200', flags.status, 200)
  ok('flags 已存', flags.json.flags.welcomeSeen === true)
}

console.log('\n=== 8. 数据损坏保护 ===')
{
  const treePath = path.join(DATA, 'trees', `${docB}.json`)
  await fsp.writeFile(treePath, '{"nodes":{"x":{"id":"x"', 'utf8')
  const r = await get(`/api/doc/${docB}`)
  eq('损坏的树 → 500', r.status, 500)
  ok('报错里说明已备份', /备份/.test(r.json?.error || r.text), r.json?.error)
  const files = await fsp.readdir(path.join(DATA, 'trees'))
  ok('生成了 .corrupt 备份', files.some((f) => f.includes('.corrupt-')), files.join(','))
  ok('损坏的树没有被空树覆盖', !fs.existsSync(treePath))
}

console.log('\n=== 9. 删除 / 原子写 ===')
{
  const del = await post('/api/doc/purge', { id: docB })
  eq('彻底删除 200', del.status, 200)
  const d = await get(`/api/doc/${docB}`)
  eq('删除后 404', d.status, 404)
  const docDir = await fsp.readdir(path.join(DATA, 'docs'))
  ok('没有留下 .tmp 临时文件', !docDir.some((f) => f.endsWith('.tmp')), docDir.join(','))
  const treeDir = await fsp.readdir(path.join(DATA, 'trees'))
  ok('树目录没有 .tmp', !treeDir.some((f) => f.endsWith('.tmp')), treeDir.join(','))
}

/* ---------------- 收尾 ---------------- */
mock.close()
console.log('\n================ API 结果 ================')
console.log(`通过 ${pass} 项，失败 ${fails.length} 项`)
if (fails.length) {
  for (const f of fails) console.log('  - ' + f)
  process.exitCode = 1
}
await fsp.rm(DATA, { recursive: true, force: true }).catch(() => {})
setTimeout(() => process.exit(process.exitCode || 0), 200)
