// 本地存储：data/docs/<id>.json、data/trees/<id>.json、data/files/<id><ext>
// 组：data/groups.json，组内文档共用 data/trees/group-<groupId>.json
//
// v153 起：所有写入都是「写临时文件 → rename」的原子替换；
// 读到损坏的 JSON 不再静默当成空数据（那会让下一次保存把原文件覆盖成空），
// 而是把坏文件改名成 .corrupt-<时间戳> 备份，并抛出 CorruptData 让上层报错。
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { assertDocId, assertGroupId, CorruptData, NotFound } from './ids.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = process.env.DOCTREE_DATA || path.join(root, 'data')
const DOCS = path.join(DATA, 'docs')
const TREES = path.join(DATA, 'trees')
const FILES = path.join(DATA, 'files')
const GROUPS = path.join(DATA, 'groups.json')
const FLAGS = path.join(DATA, 'flags.json')

export const SCHEMA = 2
export { DATA }

export async function ensureDirs() {
  for (const d of [DATA, DOCS, TREES, FILES]) await fsp.mkdir(d, { recursive: true })
}

export const filesDir = FILES

export function filePath(id, ext) {
  assertDocId(id)
  if (!/^\.[a-z0-9]{1,8}$/i.test(String(ext || ''))) throw new NotFound('文件类型异常')
  return path.join(FILES, id + ext)
}

export async function saveFile(id, ext, buf) {
  await ensureDirs()
  await atomicWrite(filePath(id, ext), buf)
}

export async function deleteFile(id, ext) {
  try {
    await fsp.rm(filePath(id, ext), { force: true })
  } catch {}
}

/* ---------------- 原子写 / 损坏隔离 ---------------- */

async function atomicWrite(file, data) {
  const dir = path.dirname(file)
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`)
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8')
  const fh = await fsp.open(tmp, 'w')
  try {
    await fh.writeFile(buf)
    await fh.sync() // 尽量把数据落盘，再换名
  } finally {
    await fh.close()
  }
  // Windows 上 rename 偶发 EPERM/EBUSY（杀毒/索引/另一个句柄刚关），退避重试几次
  let lastErr = null
  for (let i = 0; i < 5; i++) {
    try {
      await fsp.rename(tmp, file)
      return
    } catch (e) {
      lastErr = e
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) break
      await new Promise((r) => setTimeout(r, 30 * (i + 1)))
    }
  }
  await fsp.rm(tmp, { force: true }).catch(() => {})
  throw lastErr
}

async function quarantine(file, err) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
  const bad = `${file}.corrupt-${stamp}`
  try {
    await fsp.rename(file, bad)
  } catch {}
  console.error(`[store] 数据损坏，已备份为 ${path.basename(bad)}：`, err && err.message)
  return bad
}

async function readJsonFile(file, { fallback = null } = {}) {
  let raw
  try {
    raw = await fsp.readFile(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return fallback
    throw e
  }
  try {
    const j = JSON.parse(raw)
    if (!j || typeof j !== 'object') throw new Error('不是对象')
    return j
  } catch (e) {
    const bad = await quarantine(file, e)
    throw new CorruptData(`数据文件损坏（已备份为 ${path.basename(bad)}）`, file)
  }
}

/* ---------------- 组 ---------------- */

export async function listGroups() {
  const j = await readJsonFile(GROUPS, { fallback: { groups: [] } })
  return Array.isArray(j.groups) ? j.groups : []
}

async function saveGroups(groups) {
  await ensureDirs()
  await atomicWrite(GROUPS, JSON.stringify({ schema: SCHEMA, groups }))
}

export async function getGroup(id) {
  if (!/^[0-9a-f]{6,32}$/.test(String(id || ''))) return null
  return (await listGroups()).find((g) => g.id === id) || null
}

export async function groupOfDoc(docId) {
  if (!/^[0-9a-f]{6,32}$/.test(String(docId || ''))) return null
  return (await listGroups()).find((g) => (g.docIds || []).includes(docId)) || null
}

function groupTreePath(id) {
  assertGroupId(id)
  return path.join(TREES, `group-${id}.json`)
}

async function readTreeFile(p) {
  const t = await readJsonFile(p, { fallback: { nodes: {} } })
  if (!t.nodes || typeof t.nodes !== 'object') t.nodes = {}
  return t
}

async function mergeDocTreeInto(nodes, docId) {
  assertDocId(docId)
  const t = await readTreeFile(path.join(TREES, `${docId}.json`))
  for (const [id, n] of Object.entries(t.nodes || {})) nodes[id] = n
}

export async function createGroup(name, docIds) {
  docIds.forEach(assertDocId)
  const groups = await listGroups()
  const id = crypto.randomUUID().slice(0, 8)
  const nodes = {}
  for (const docId of docIds) await mergeDocTreeInto(nodes, docId)
  for (const g of groups) g.docIds = (g.docIds || []).filter((d) => !docIds.includes(d))
  const kept = groups.filter((g) => (g.docIds || []).length >= 2)
  kept.push({ id, name: name || `组 ${kept.length + 1}`, docIds: [...docIds], createdAt: Date.now() })
  await saveGroups(kept)
  await ensureDirs()
  await atomicWrite(groupTreePath(id), JSON.stringify({ schema: SCHEMA, nodes }))
  return kept[kept.length - 1]
}

export async function updateGroup(id, { name, add = [], remove = [] } = {}) {
  assertGroupId(id)
  add.forEach(assertDocId)
  remove.forEach(assertDocId)
  const groups = await listGroups()
  const g = groups.find((x) => x.id === id)
  if (!g) return null
  if (typeof name === 'string' && name.trim()) g.name = name.trim()
  if (remove.length) {
    const tree = await readTreeFile(groupTreePath(id))
    for (const docId of remove) await atomicWrite(path.join(TREES, `${docId}.json`), JSON.stringify(tree))
    g.docIds = (g.docIds || []).filter((d) => !remove.includes(d))
  }
  if (add.length) {
    const tree = await readTreeFile(groupTreePath(id))
    for (const docId of add) {
      await mergeDocTreeInto(tree.nodes, docId)
      for (const other of groups) if (other.id !== id) other.docIds = (other.docIds || []).filter((d) => d !== docId)
    }
    await atomicWrite(groupTreePath(id), JSON.stringify(tree))
    g.docIds.push(...add.filter((d) => !g.docIds.includes(d)))
  }
  for (const x of [...groups]) {
    if ((x.docIds || []).length >= 2) continue
    const tree = await readTreeFile(groupTreePath(x.id))
    for (const docId of x.docIds) await atomicWrite(path.join(TREES, `${docId}.json`), JSON.stringify(tree))
    await fsp.rm(groupTreePath(x.id), { force: true })
    groups.splice(groups.indexOf(x), 1)
  }
  await saveGroups(groups)
  return groups.find((x) => x.id === id) || null
}

export async function dissolveGroup(id) {
  assertGroupId(id)
  const groups = await listGroups()
  const g = groups.find((x) => x.id === id)
  if (!g) return false
  const tree = await readTreeFile(groupTreePath(id))
  for (const docId of g.docIds || []) await atomicWrite(path.join(TREES, `${docId}.json`), JSON.stringify(tree))
  await fsp.rm(groupTreePath(id), { force: true })
  await saveGroups(groups.filter((x) => x.id !== id))
  return true
}

/* ---------------- flags ---------------- */

export async function getFlags() {
  return readJsonFile(FLAGS, { fallback: {} })
}

export async function setFlags(patch) {
  const cur = await getFlags()
  const next = { ...cur, ...patch }
  await ensureDirs()
  await atomicWrite(FLAGS, JSON.stringify(next))
  return next
}

/* ---------------- 文档 ---------------- */

export async function listDocs() {
  await ensureDirs()
  const names = await fsp.readdir(DOCS)
  const groups = await listGroups()
  const groupOf = new Map()
  for (const g of groups) for (const d of g.docIds || []) groupOf.set(d, g.id)
  const out = []
  for (const n of names) {
    if (!n.endsWith('.json') || n.startsWith('.')) continue
    let d
    try {
      d = await readJsonFile(path.join(DOCS, n))
    } catch {
      continue // 损坏的文档不拖垮整个列表
    }
    if (!d || !d.id) continue
    out.push({
      id: d.id,
      title: d.title,
      kind: d.kind,
      createdAt: d.createdAt,
      bytes: d.bytes,
      pages: d.pages?.length || 0,
      hash: d.hash || '',
      hidden: Boolean(d.hidden),
      updatedAt: d.updatedAt || d.createdAt,
      groupId: groupOf.get(d.id) || null
    })
  }
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export async function getDoc(id) {
  assertDocId(id)
  return readJsonFile(path.join(DOCS, `${id}.json`), { fallback: null })
}

export async function saveDoc(doc) {
  assertDocId(doc?.id)
  await ensureDirs()
  const next = { ...doc, schema: SCHEMA }
  await atomicWrite(path.join(DOCS, `${next.id}.json`), JSON.stringify(next))
  return next
}

export async function setHidden(id, hidden) {
  const doc = await getDoc(id)
  if (!doc) return false
  doc.hidden = Boolean(hidden)
  doc.updatedAt = Date.now()
  await saveDoc(doc)
  return true
}

export async function deleteDoc(id) {
  assertDocId(id)
  const doc = await getDoc(id)
  if (doc) await deleteFile(id, doc.ext)
  await fsp.rm(path.join(DOCS, `${id}.json`), { force: true })
  await fsp.rm(path.join(TREES, `${id}.json`), { force: true })
  const groups = await listGroups()
  let changed = false
  for (const g of groups) {
    if (!(g.docIds || []).includes(id)) continue
    g.docIds = g.docIds.filter((d) => d !== id)
    changed = true
    if (g.docIds.length < 2) {
      const tree = await readTreeFile(groupTreePath(g.id))
      for (const d of g.docIds) await atomicWrite(path.join(TREES, `${d}.json`), JSON.stringify(tree))
      await fsp.rm(groupTreePath(g.id), { force: true })
      g.docIds = []
    }
  }
  if (changed) await saveGroups(groups.filter((g) => (g.docIds || []).length > 0))
}

/* ---------------- 提问树（组内共用） ---------------- */

async function treePathFor(id) {
  assertDocId(id)
  const g = await groupOfDoc(id)
  return g ? groupTreePath(g.id) : path.join(TREES, `${id}.json`)
}

export async function getTree(id) {
  return readTreeFile(await treePathFor(id))
}

export async function saveTree(id, tree) {
  await ensureDirs()
  const p = await treePathFor(id)
  await atomicWrite(p, JSON.stringify({ schema: SCHEMA, ...tree }))
}
