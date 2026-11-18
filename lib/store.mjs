// 本地存储：data/docs/<id>.json、data/trees/<id>.json、data/files/<id><ext>
// 组：data/groups.json，组内文档共用 data/trees/group-<groupId>.json
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 桌面版会把数据目录指到 userData，避免写安装目录
const DATA = process.env.DOCTREE_DATA || path.join(root, 'data')
const DOCS = path.join(DATA, 'docs')
const TREES = path.join(DATA, 'trees')
const FILES = path.join(DATA, 'files')
const GROUPS = path.join(DATA, 'groups.json')

export async function ensureDirs() {
  for (const d of [DATA, DOCS, TREES, FILES]) await fsp.mkdir(d, { recursive: true })
}

export const filesDir = FILES

export function filePath(id, ext) {
  return path.join(FILES, id + ext)
}

export async function saveFile(id, ext, buf) {
  await fsp.writeFile(filePath(id, ext), buf)
}

export async function deleteFile(id, ext) {
  await fsp.rm(filePath(id, ext), { force: true })
}

// ---------- 组 ----------
export async function listGroups() {
  try {
    const j = JSON.parse(await fsp.readFile(GROUPS, 'utf8'))
    return Array.isArray(j.groups) ? j.groups : []
  } catch {
    return []
  }
}

async function saveGroups(groups) {
  await ensureDirs()
  await fsp.writeFile(GROUPS, JSON.stringify({ groups }))
}

export async function getGroup(id) {
  return (await listGroups()).find((g) => g.id === id) || null
}

export async function groupOfDoc(docId) {
  return (await listGroups()).find((g) => g.docIds.includes(docId)) || null
}

function groupTreePath(id) {
  return path.join(TREES, `group-${id}.json`)
}

async function readTreeFile(p) {
  try {
    const t = JSON.parse(await fsp.readFile(p, 'utf8'))
    if (!t.nodes) t.nodes = {}
    return t
  } catch {
    return { nodes: {} }
  }
}

async function mergeDocTreeInto(nodes, docId) {
  const t = await readTreeFile(path.join(TREES, `${docId}.json`))
  for (const [id, n] of Object.entries(t.nodes || {})) nodes[id] = n
}

export async function createGroup(name, docIds) {
  const groups = await listGroups()
  const id = crypto.randomUUID().slice(0, 8)
  const nodes = {}
  for (const docId of docIds) await mergeDocTreeInto(nodes, docId)
  // 从原有组里摘掉
  for (const g of groups) g.docIds = g.docIds.filter((d) => !docIds.includes(d))
  const kept = groups.filter((g) => g.docIds.length >= 2)
  kept.push({ id, name: name || `组 ${kept.length + 1}`, docIds: [...docIds], createdAt: Date.now() })
  await saveGroups(kept)
  await ensureDirs()
  await fsp.writeFile(groupTreePath(id), JSON.stringify({ nodes }))
  return kept[kept.length - 1]
}

export async function updateGroup(id, { name, add = [], remove = [] } = {}) {
  const groups = await listGroups()
  const g = groups.find((x) => x.id === id)
  if (!g) return null
  if (typeof name === 'string' && name.trim()) g.name = name.trim()
  if (remove.length) {
    const tree = await readTreeFile(groupTreePath(id))
    for (const docId of remove) {
      // 离开组：把组树复制一份给该文档
      await fsp.writeFile(path.join(TREES, `${docId}.json`), JSON.stringify(tree))
    }
    g.docIds = g.docIds.filter((d) => !remove.includes(d))
  }
  if (add.length) {
    const tree = await readTreeFile(groupTreePath(id))
    for (const docId of add) {
      await mergeDocTreeInto(tree.nodes, docId)
      for (const other of groups) if (other.id !== id) other.docIds = other.docIds.filter((d) => d !== docId)
    }
    await fsp.writeFile(groupTreePath(id), JSON.stringify(tree))
    g.docIds.push(...add.filter((d) => !g.docIds.includes(d)))
  }
  // 少于 2 份的组自动解散：树复制给剩下的文档
  for (const x of [...groups]) {
    if (x.docIds.length >= 2) continue
    const tree = await readTreeFile(groupTreePath(x.id))
    for (const docId of x.docIds) {
      await fsp.writeFile(path.join(TREES, `${docId}.json`), JSON.stringify(tree))
    }
    await fsp.rm(groupTreePath(x.id), { force: true })
    groups.splice(groups.indexOf(x), 1)
  }
  await saveGroups(groups)
  return groups.find((x) => x.id === id) || null
}

export async function dissolveGroup(id) {
  const groups = await listGroups()
  const g = groups.find((x) => x.id === id)
  if (!g) return false
  const tree = await readTreeFile(groupTreePath(id))
  for (const docId of g.docIds) {
    await fsp.writeFile(path.join(TREES, `${docId}.json`), JSON.stringify(tree))
  }
  await fsp.rm(groupTreePath(id), { force: true })
  await saveGroups(groups.filter((x) => x.id !== id))
  return true
}

const FLAGS = path.join(DATA, 'flags.json')

export async function getFlags() {
  try {
    return JSON.parse(await fsp.readFile(FLAGS, 'utf8'))
  } catch {
    return {}
  }
}

export async function setFlags(patch) {
  const cur = await getFlags()
  const next = { ...cur, ...patch }
  await ensureDirs()
  await fsp.writeFile(FLAGS, JSON.stringify(next))
  return next
}

// ---------- 文档 ----------
export async function listDocs() {
  await ensureDirs()
  const names = await fsp.readdir(DOCS)
  const groups = await listGroups()
  const groupOf = new Map()
  for (const g of groups) for (const d of g.docIds) groupOf.set(d, g.id)
  const out = []
  for (const n of names) {
    if (!n.endsWith('.json')) continue
    try {
      const d = JSON.parse(await fsp.readFile(path.join(DOCS, n), 'utf8'))
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
    } catch {}
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getDoc(id) {
  const p = path.join(DOCS, `${id}.json`)
  if (!fs.existsSync(p)) return null
  return JSON.parse(await fsp.readFile(p, 'utf8'))
}

export async function saveDoc(doc) {
  await ensureDirs()
  await fsp.writeFile(path.join(DOCS, `${doc.id}.json`), JSON.stringify(doc))
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
  const doc = await getDoc(id)
  if (doc) await deleteFile(id, doc.ext)
  await fsp.rm(path.join(DOCS, `${id}.json`), { force: true })
  await fsp.rm(path.join(TREES, `${id}.json`), { force: true })
  // 组内成员被删除：摘掉；只剩一个就解散
  const groups = await listGroups()
  let changed = false
  for (const g of groups) {
    if (!g.docIds.includes(id)) continue
    g.docIds = g.docIds.filter((d) => d !== id)
    changed = true
    if (g.docIds.length < 2) {
      const tree = await readTreeFile(groupTreePath(g.id))
      for (const d of g.docIds) await fsp.writeFile(path.join(TREES, `${d}.json`), JSON.stringify(tree))
      await fsp.rm(groupTreePath(g.id), { force: true })
      g.docIds = []
    }
  }
  if (changed) await saveGroups(groups.filter((g) => g.docIds.length > 0))
}

// ---------- 提问树（组内共用） ----------
async function treePathFor(id) {
  const g = await groupOfDoc(id)
  return g ? groupTreePath(g.id) : path.join(TREES, `${id}.json`)
}

export async function getTree(id) {
  return readTreeFile(await treePathFor(id))
}

export async function saveTree(id, tree) {
  await ensureDirs()
  await fsp.writeFile(await treePathFor(id), JSON.stringify(tree))
}
