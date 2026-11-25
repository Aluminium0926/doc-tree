// 文档组
import * as store from '../store.mjs'
import { json } from '../http/respond.mjs'
import { readJson } from '../http/body.mjs'
import { guardWrite } from '../http/guard.mjs'
import { assertGroupId, assertDocId } from '../ids.mjs'

const idsOf = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 50) : [])

export async function createGroup({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const ids = idsOf(body.docIds)
  ids.forEach(assertDocId)
  if (ids.length < 2) return json(res, 400, { error: '至少选择两份文档' })
  const group = await store.createGroup(String(body.name || '').trim().slice(0, 40), ids)
  json(res, 200, { group })
}

export async function updateGroup({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const id = assertGroupId(body.id)
  const add = idsOf(body.add)
  const remove = idsOf(body.remove)
  add.forEach(assertDocId)
  remove.forEach(assertDocId)
  const group = await store.updateGroup(id, { name: body.name, add, remove })
  json(res, 200, { group, dissolved: !group })
}

export async function dissolveGroup({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const id = assertGroupId(body.id)
  json(res, 200, { ok: await store.dissolveGroup(id) })
}
