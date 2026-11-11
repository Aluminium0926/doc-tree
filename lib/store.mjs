// 本地存储：data/docs/<id>.json、data/trees/<id>.json、data/files/<id><ext>
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 桌面版会把数据目录指到 userData，避免写安装目录
const DATA = process.env.DOCTREE_DATA || path.join(root, 'data')
const DOCS = path.join(DATA, 'docs')
const TREES = path.join(DATA, 'trees')
const FILES = path.join(DATA, 'files')

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

export async function listDocs() {
  await ensureDirs()
  const names = await fsp.readdir(DOCS)
  const out = []
  for (const n of names) {
    if (!n.endsWith('.json')) continue
    try {
      const d = JSON.parse(await fsp.readFile(path.join(DOCS, n), 'utf8'))
      out.push({ id: d.id, title: d.title, kind: d.kind, createdAt: d.createdAt, bytes: d.bytes, pages: d.pages?.length || 0 })
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

export async function deleteDoc(id) {
  const doc = await getDoc(id)
  if (doc) await deleteFile(id, doc.ext)
  await fsp.rm(path.join(DOCS, `${id}.json`), { force: true })
  await fsp.rm(path.join(TREES, `${id}.json`), { force: true })
}

export async function getTree(id) {
  const p = path.join(TREES, `${id}.json`)
  if (!fs.existsSync(p)) return { nodes: {} }
  try {
    const t = JSON.parse(await fsp.readFile(p, 'utf8'))
    if (!t.nodes) t.nodes = {}
    return t
  } catch {
    return { nodes: {} }
  }
}

export async function saveTree(id, tree) {
  await ensureDirs()
  await fsp.writeFile(path.join(TREES, `${id}.json`), JSON.stringify(tree))
}
