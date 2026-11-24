// /api/state、/api/usage、/api/flags、/api/config
import * as store from '../store.mjs'
import * as llm from '../llm.mjs'
import { json } from '../http/respond.mjs'
import { readJson } from '../http/body.mjs'
import { guardWrite } from '../http/guard.mjs'

export async function state({ res }) {
  const [docs, groups, flags] = await Promise.all([store.listDocs(), store.listGroups(), store.getFlags()])
  json(res, 200, { docs, groups, flags, config: llm.publicConfig(), serverVersion: SERVER_VERSION })
}

let SERVER_VERSION = '0.0.0'
export function setServerVersion(v) {
  SERVER_VERSION = v
}

export async function usage({ res }) {
  const docs = await store.listDocs()
  const groups = await store.listGroups()
  const groupName = new Map(groups.map((g) => [g.id, g.name]))
  const seen = new Set()
  const totals = { input: 0, output: 0, cacheHit: 0, cacheMiss: 0, total: 0, requests: 0, rounds: 0 }
  const dayMap = new Map()
  const docMap = new Map()
  const dayKey = (t) => {
    const d = new Date(t)
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  for (const doc of docs) {
    const key = doc.groupId || doc.id
    if (seen.has(key)) continue
    seen.add(key)
    let tree
    try {
      tree = await store.getTree(doc.id)
    } catch {
      continue
    }
    for (const n of Object.values(tree.nodes || {})) {
      const u = n.usage
      if (!u) continue
      totals.input += u.input || 0
      totals.output += u.output || 0
      totals.cacheHit += u.cacheHit || 0
      totals.cacheMiss += u.cacheMiss || 0
      totals.total += u.total || (u.input || 0) + (u.output || 0)
      totals.requests += 1
      totals.rounds += u.rounds || 1
      const dk = dayKey(n.createdAt || Date.now())
      if (!dayMap.has(dk)) dayMap.set(dk, { date: dk, input: 0, output: 0, cacheHit: 0, cacheMiss: 0, total: 0, requests: 0 })
      const dd = dayMap.get(dk)
      dd.input += u.input || 0
      dd.output += u.output || 0
      dd.cacheHit += u.cacheHit || 0
      dd.cacheMiss += u.cacheMiss || 0
      dd.total += u.total || (u.input || 0) + (u.output || 0)
      dd.requests += 1
      if (!docMap.has(key)) {
        docMap.set(key, {
          title: doc.groupId ? groupName.get(doc.groupId) || doc.title : doc.title,
          total: 0,
          cacheHit: 0,
          cacheMiss: 0,
          requests: 0
        })
      }
      const dm = docMap.get(key)
      dm.total += u.total || (u.input || 0) + (u.output || 0)
      dm.cacheHit += u.cacheHit || 0
      dm.cacheMiss += u.cacheMiss || 0
      dm.requests += 1
    }
  }
  const hitRate = totals.cacheHit + totals.cacheMiss > 0 ? totals.cacheHit / (totals.cacheHit + totals.cacheMiss) : 0
  json(res, 200, {
    totals: { ...totals, hitRate },
    days: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14),
    docs: [...docMap.values()].sort((a, b) => b.total - a.total).slice(0, 8)
  })
}

export async function setFlags({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const patch = {}
  for (const k of ['welcomeSeen', 'guideSeen']) if (typeof body[k] === 'boolean') patch[k] = body[k]
  json(res, 200, { flags: await store.setFlags(patch) })
}

export async function setConfig({ req, res }) {
  guardWrite(req, { json: true })
  const body = await readJson(req)
  const patch = {}
  for (const k of ['baseUrl', 'model', 'visionModel', 'visionBaseUrl', 'apiFormat', 'visionFormat', 'pageImage']) {
    if (typeof body[k] === 'string' && body[k].trim()) patch[k] = body[k].trim()
  }
  if (typeof body.apiKey === 'string' && body.apiKey.trim()) patch.apiKey = body.apiKey.trim()
  if (typeof body.visionApiKey === 'string' && body.visionApiKey.trim()) patch.visionApiKey = body.visionApiKey.trim()
  if (body.visionApiKey === '') patch.visionApiKey = ''
  if (body.visionBaseUrl === '') patch.visionBaseUrl = ''
  if (['low', 'high', 'max'].includes(body.effort)) patch.effort = body.effort
  llm.writeConfig(patch)
  json(res, 200, { config: llm.publicConfig() })
}
