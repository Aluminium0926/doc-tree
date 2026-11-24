// 页面栅格化：PDF → dataURL PNG；图片文档直接读原文件
import fsp from 'node:fs/promises'
import * as store from './store.mjs'

const cache = new Map() // `${docId}:${page}` -> dataURL
const locks = new Map()
const MAX_CACHE = 24
const MAX_HANDLES = 2
const handles = new Map() // file -> { doc, used }  句柄复用：以前每渲染一页都要重新打开整个 PDF

const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' }

async function closeHandle(file) {
  const h = handles.get(file)
  if (!h) return
  handles.delete(file)
  try {
    await h.doc.destroy()
  } catch {}
}

async function getHandle(file) {
  const hit = handles.get(file)
  if (hit) {
    hit.used = Date.now()
    return hit.doc
  }
  const { pdf } = await import('pdf-to-img')
  const doc = await pdf(file, { scale: 1.4 })
  handles.set(file, { doc, used: Date.now() })
  if (handles.size > MAX_HANDLES) {
    const oldest = [...handles.entries()].sort((a, b) => a[1].used - b[1].used)[0]
    if (oldest) await closeHandle(oldest[0])
  }
  return doc
}

export async function renderPageImage(doc, pageNo) {
  if (!doc) return null
  if (doc.kind === 'image') {
    const mime = IMAGE_MIME[doc.ext] || 'image/png'
    const buf = await fsp.readFile(store.filePath(doc.id, doc.ext))
    return 'data:' + mime + ';base64,' + buf.toString('base64')
  }
  if (doc.kind !== 'pdf') return null
  const page = Math.max(1, Number(pageNo) || 1)
  const key = `${doc.id}:${page}`
  if (cache.has(key)) {
    const v = cache.get(key)
    cache.delete(key)
    cache.set(key, v)
    return v
  }
  if (locks.has(key)) return locks.get(key)

  const job = (async () => {
    const file = store.filePath(doc.id, doc.ext || '.pdf')
    let docImg
    try {
      docImg = await getHandle(file)
      if (page > docImg.length) return null
      const buf = await docImg.getPage(page)
      const url = 'data:image/png;base64,' + Buffer.from(buf).toString('base64')
      cache.set(key, url)
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value)
      return url
    } catch (e) {
      // 句柄可能已失效（文件被替换/损坏），丢掉重开一次
      await closeHandle(file)
      throw e
    }
  })()

  locks.set(key, job)
  try {
    return await job
  } finally {
    locks.delete(key)
  }
}

export function pageImageCacheSize() {
  return cache.size
}

export async function closeAllRenderHandles() {
  for (const file of [...handles.keys()]) await closeHandle(file)
}
