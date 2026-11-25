// 提问 / 续写 / 指令 / 高亮 / 删节点
import * as store from '../store.mjs'
import * as llm from '../llm.mjs'
import { json } from '../http/respond.mjs'
import { readJson } from '../http/body.mjs'
import { guardWrite } from '../http/guard.mjs'
import { assertDocId } from '../ids.mjs'
import { runAsk } from '../services/ask.mjs'

export async function ask(ctx) {
  guardWrite(ctx.req, { json: true })
  ctx.body = await readJson(ctx.req)
  await runAsk(ctx, { resume: false })
}

export async function resume(ctx) {
  guardWrite(ctx.req, { json: true })
  ctx.body = await readJson(ctx.req)
  await runAsk(ctx, { resume: true })
}

export async function setInstruction({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const doc = await store.getDoc(assertDocId(body.docId))
  if (!doc) return json(res, 404, { error: '文档不存在' })
  const text = String(body.text || '').trim().slice(0, 500)
  if (!text) return json(res, 400, { error: '指令不能为空' })
  if (/^(清除|清空).*指令$/.test(text)) {
    doc.instructions = []
    await store.saveDoc(doc)
    return json(res, 200, { ok: true, count: 0, reply: '已清除所有指令' })
  }
  const cfg = llm.readConfig()
  if (!cfg.apiKey) return json(res, 400, { error: '未配置 API Key' })
  let reply = ''
  try {
    const s = await llm.chat(
      [
        { role: 'system', content: '你是「文档树」的指令接收器。用户会给出关于后续回答方式的指令。只回复一句简短确认（不超过 20 字），不要解释、不要重复指令。' },
        { role: 'user', content: text }
      ],
      { maxTokens: 60, effort: 'low' }
    )
    reply = String(s || '').trim().slice(0, 60)
  } catch {}
  doc.instructions = [...(doc.instructions || []), text].slice(-20)
  await store.saveDoc(doc)
  json(res, 200, { ok: true, count: doc.instructions.length, reply })
}

export async function removeInstruction({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const doc = await store.getDoc(assertDocId(body.docId))
  if (!doc) return json(res, 404, { error: '文档不存在' })
  if (body.clear) doc.instructions = []
  else {
    const list = Array.isArray(doc.instructions) ? doc.instructions : []
    const i = Number(body.index)
    if (Number.isInteger(i) && i >= 0 && i < list.length) list.splice(i, 1)
    doc.instructions = list
  }
  await store.saveDoc(doc)
  json(res, 200, { ok: true, count: doc.instructions.length, instructions: doc.instructions })
}

export async function setHighlights({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const doc = await store.getDoc(assertDocId(body.docId))
  if (!doc) return json(res, 404, { error: '文档不存在' })
  doc.highlights = Array.isArray(body.highlights) ? body.highlights.slice(0, 3000) : []
  await store.saveDoc(doc)
  json(res, 200, { ok: true, count: doc.highlights.length })
}

export async function deleteNode({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const docId = assertDocId(body.docId)
  const nodeId = String(body.nodeId || '')
  if (!/^[0-9a-z]{6,40}$/i.test(nodeId)) return json(res, 400, { error: '节点 id 不合法' })
  const tree = await store.getTree(docId)
  const kill = new Set([nodeId])
  let grew = true
  while (grew) {
    grew = false
    for (const n of Object.values(tree.nodes)) {
      if (n.parentId && kill.has(n.parentId) && !kill.has(n.id)) {
        kill.add(n.id)
        grew = true
      }
    }
  }
  for (const id of kill) delete tree.nodes[id]
  await store.saveTree(docId, tree)
  json(res, 200, { removed: [...kill] })
}
