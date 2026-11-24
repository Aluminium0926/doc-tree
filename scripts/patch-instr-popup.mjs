import fs from 'node:fs'

// 1) server：删除/清空指令
let s = fs.readFileSync('server.mjs', 'utf8')
if (!s.includes("'/api/instruction/remove'")) {
  const route = `  if (p === '/api/instruction/remove' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const doc = await store.getDoc(body.docId)
    if (!doc) return json(res, 404, { error: '文档不存在' })
    if (body.clear) doc.instructions = []
    else {
      const list = Array.isArray(doc.instructions) ? doc.instructions : []
      const i = Number(body.index)
      if (Number.isInteger(i) && i >= 0 && i < list.length) list.splice(i, 1)
      doc.instructions = list
    }
    await store.saveDoc(doc)
    return json(res, 200, { ok: true, count: doc.instructions.length, instructions: doc.instructions })
  }

`
  s = s.replace("  if (p === '/api/instruction' && req.method === 'POST')", route + "  if (p === '/api/instruction' && req.method === 'POST')")
  fs.writeFileSync('server.mjs', s)
}

// 2) mobile 同样接口
let m = fs.readFileSync('mobile/src/api.js', 'utf8')
if (!m.includes("'/api/instruction/remove'")) {
  const route = `  if (p === '/api/instruction/remove' && method === 'POST') {
    const body = await bodyJson(init)
    const doc = await db.getDoc(body.docId)
    if (!doc) return json({ error: '文档不存在' }, 404)
    if (body.clear) doc.instructions = []
    else {
      const list = Array.isArray(doc.instructions) ? doc.instructions : []
      const i = Number(body.index)
      if (Number.isInteger(i) && i >= 0 && i < list.length) list.splice(i, 1)
      doc.instructions = list
    }
    await db.saveDoc(doc)
    return json({ ok: true, count: doc.instructions.length, instructions: doc.instructions })
  }

`
  m = m.replace("  if (p === '/api/instruction' && method === 'POST')", route + "  if (p === '/api/instruction' && method === 'POST')")
  fs.writeFileSync('mobile/src/api.js', m)
}

// 3) HTML 弹层
let h = fs.readFileSync('public/index.html', 'utf8')
if (!h.includes('instr-pop')) {
  h = h.replace('</body>', `<div id="instr-pop" class="instr-pop" hidden>
  <div class="ip-head">附加指令</div>
  <div id="instr-list"></div>
  <button id="instr-clear">清空全部</button>
</div>
</body>`)
  fs.writeFileSync('public/index.html', h)
}
console.log('instruction remove backend + popup markup ok')
